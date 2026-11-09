// A made-up model of a coffee shop, the same as the starter app.
import type { CausalDataset } from "@cytocausal/core";

export const dataset: CausalDataset = {
  id: "coffee-shop",
  snapshots: [
    {
      id: "V1",
      nodes: [
        { id: "customers", label: "Customers" },
        { id: "queue", label: "Queue length" },
        {
          id: "satisfaction",
          label: "Satisfaction",
          evidence: [{ text: "People leave when the line is long" }],
        },
      ],
      edges: [
        { id: "customers-queue", source: "customers", target: "queue", polarity: "positive" },
        { id: "queue-satisfaction", source: "queue", target: "satisfaction", polarity: "negative" },
        {
          id: "satisfaction-customers",
          source: "satisfaction",
          target: "customers",
          polarity: "positive",
        },
      ],
    },
    {
      id: "final",
      nodes: [
        { id: "customers", label: "Customers" },
        { id: "queue", label: "Queue length" },
        {
          id: "customer-satisfaction",
          label: "Customer satisfaction",
          evidence: [{ text: "Renamed from Satisfaction after review" }],
        },
        { id: "revenue", label: "Revenue" },
        { id: "staff", label: "Staff on shift" },
      ],
      edges: [
        { id: "customers-queue", source: "customers", target: "queue", polarity: "positive" },
        {
          id: "queue-satisfaction",
          source: "queue",
          target: "customer-satisfaction",
          polarity: "negative",
        },
        {
          id: "satisfaction-customers",
          source: "customer-satisfaction",
          target: "customers",
          polarity: "positive",
        },
        { id: "customers-revenue", source: "customers", target: "revenue", polarity: "positive" },
        { id: "revenue-staff", source: "revenue", target: "staff", polarity: "positive" },
        { id: "staff-queue", source: "staff", target: "queue", polarity: "negative" },
      ],
    },
  ],
  correspondences: [
    {
      from: "V1",
      to: "final",
      nodes: {
        customers: "customers",
        queue: "queue",
        satisfaction: "customer-satisfaction",
      },
    },
  ],
};
