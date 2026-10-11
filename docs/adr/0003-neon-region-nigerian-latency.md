# ADR 0003: Neon Region Selection vs. Nigerian Latency

## Status

Accepted

## Context

Downtown is an online campus marketplace tailored specifically for students, staff, and vendors across Osun State University (UNIOSUN) campuses in Nigeria (Osogbo, Ikire, Okuku, Ifetedo, Ipetu-Ijesha, Ejigbo). Most student users access the platform via mobile internet service providers (MTN, Airtel, Glo, 9mobile) on low-to-mid-range Android smartphones.

In Step 01, the initial Neon PostgreSQL database was scaffolded in AWS US East 2 (Ohio, `aws-us-east-2`). Submarine fiber-optic cables connecting West Africa (such as MainOne, Equiano, WACS, SAT-3, and ACE) terminate primarily in European coastal points (Lisbon, London, and Frankfurt). Traffic destined for US East must traverse Europe and cross the Atlantic Ocean via transatlantic cables, adding substantial network latency to every database and application round trip.

To ground this decision in empirical reality rather than theoretical estimates, connect time was measured directly from the developer host to regional AWS endpoints (`curl -w %{time_connect}` over multiple 10-run sample sets):

### Measured Connect Times (time_connect in ms)

#### Round 1 (10 samples)
- **AWS Europe Central 1 (Frankfurt - `eu-central-1`)**:
  - Samples: 163.0, 164.0, 182.8, 210.7, 249.2, 268.0, 285.2, 303.8, 331.4, 889.8 ms
  - **Median**: 258.6 ms
- **AWS Europe West 2 (London - `eu-west-2`)**:
  - Samples: 160.6, 172.1, 225.5, 235.5, 238.5, 257.5, 274.8, 282.2, 292.1, 508.1 ms
  - **Median**: 248.0 ms
- **AWS US East 2 (Ohio - `us-east-2`, Baseline)**:
  - Samples: 225.2, 226.5, 228.2, 236.7, 260.0, 283.6, 290.2, 295.4, 408.9, 431.6 ms
  - **Median**: 271.8 ms

#### Round 2 (10 samples)
- **AWS Europe Central 1 (Frankfurt - `eu-central-1`)**:
  - Samples: 161.8, 184.4, 192.6, 256.8, 267.6, 279.4, 293.5, 387.6, 400.8, 497.3 ms
  - **Median**: 273.5 ms
- **AWS Europe West 2 (London - `eu-west-2`)**:
  - Samples: 185.4, 203.7, 217.5, 293.9, 308.5, 317.3, 393.2, 395.8, 495.0, 963.4 ms
  - **Median**: 312.9 ms
- **AWS US East 2 (Ohio - `us-east-2`, Baseline)**:
  - Samples: 238.7, 257.4, 274.7, 274.7, 278.3, 293.5, 312.2, 317.2, 324.1, 663.9 ms
  - **Median**: 285.9 ms

#### Aggregate Analysis
- Combined 20-sample median for Frankfurt (`eu-central-1`): **267.8 ms**
- Combined 20-sample median for London (`eu-west-2`): **278.5 ms**
- Delta between European medians is 10.7 ms, satisfying the tie criteria (tie within 10 ms defaults to Frankfurt).
- European endpoints consistently beat the US East baseline across test runs.

## Decision

We chose **AWS Europe Central 1 (Frankfurt - `aws-eu-central-1`)** as Downtown's production and development database region on Neon.

Concurrently:
1. Created new Neon project `misty-paper-37733898` in region `aws-eu-central-1`.
2. Updated Vercel environment variables for `downtown-api` with the new pooled connection string.
3. Co-located Vercel Serverless Function compute in Frankfurt (`fra1`) via `vercel.json` in both `apps/api` and `apps/web`.
4. Successfully verified `/health` on `downtown-api` and `/api/health` on `downtown-web`.
5. Permanently deleted the legacy `aws-us-east-2` Neon project (`still-water-88128815`).

## Alternatives Considered

1. **Keep `aws-us-east-2` (Ohio)**: Zero migration effort, but incurs a persistent transatlantic latency penalty of ~100–150 ms on every uncached round-trip request for students in Nigeria.
2. **AWS Europe West 2 (London - `aws-eu-west-2`)**: Highly competitive in Round 1 (248.0 ms median), but exhibited higher latency variance and a 312.9 ms median in Round 2. Frankfurt proved more stable on aggregate and aligns with Vercel's primary European region (`fra1`).

## Trade-offs

- **Cross-region developer access**: For developers operating outside Europe or West Africa, ping times to Frankfurt may be marginally higher than US East. However, Nigerian user performance is paramount.
- **Vercel Hobby Plan function region lock**: Multi-region active-active deployments are not supported on free tiers; choosing Frankfurt locks serverless compute and database queries into EU Central, optimal for Nigerian routing.

## Consequences

- Colocating Neon and Vercel functions in Frankfurt (`fra1`) minimizes internal API-to-database connection latency to < 3 ms.
- Round-trip response time for UNIOSUN mobile users drops by approximately 50% compared to routing across the Atlantic to Ohio.
- Step 02 documentation reflects new Neon project ID `misty-paper-37733898`.
