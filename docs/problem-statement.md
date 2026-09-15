# Problem Statement

## Background

Electric utilities operate thousands of critical assets — transformers, feeders,
breakers, and capacitors — spread across wide geographical grids. They monitor these
assets with a flood of sensor, condition, and maintenance data, but turning that data
into an operational decision is the hard part.

The classic approach (championed by predictive-maintenance systems) is to answer
*"which asset is most likely to fail?"* A high failure probability, however, does not
necessarily mean an asset has the highest operational consequence. A low-risk
transformer that feeds a substation with a hospital and hundreds of customers may
matter far more than a high-risk capacitor serving a small, non-critical load.

## The Problem

Grid operators are drowning in sensor data but starved of decisions. The hard question
isn't *"can we predict a failure?"* — it's **"given limited crews and limited time,
what do we do about it, right now?"**

Decision-making is hard because the answer depends on three separate questions that are
often conflated:

1. **Predict** — how likely is this asset to fail?
2. **Simulate** — if it *does* fail, what breaks and how many people/critical
   facilities are affected?
3. **Prioritize** — given crews and budget, which assets do we fix first?

## Who is Affected

Grid operators and distribution-utility maintenance planners. They are usually
engineers responsible for hundreds to thousands of assets with limited crews, limited
budgets, and no tool that combines failure risk, operational consequence, and
maintenance priority in one place.

## Why It Matters

- Misallocated maintenance crews mean preventable outages at critical facilities
  (hospitals, industrial plants, emergency services).
- Outage response is reactive: crews are dispatched after a failure instead of before
  it, increasing downtime and customer impact.
- Maintenance decisions based only on failure risk can be actively misleading when a
  lower-risk asset has a much higher operational consequence.

## Why Existing Solutions Fall Short

Existing predictive-maintenance tools typically stop at failure prediction. They do not
answer the consequence question ("what happens if it fails?"), nor do they turn the
answer into a ranked, actionable maintenance plan. GridGuardian AI connects all three:
**predict → simulate → prioritize**, and explains the result in an operations brief.