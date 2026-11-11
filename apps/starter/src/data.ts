import type { CausalDataset } from "@cytocausal/core";

// Replace this with your own data. It's a made-up model of a coffee shop, as a barista and a
// manager described it over five meetings. Evidence on a link records who stated it and why.
//
// V1 → V2: Satisfaction is renamed Customer satisfaction
// V2 → V3: Revenue joins, fed by customers
// V3 → V4: Staff on shift joins, first thought to lengthen the queue
// V4 → final: the barista corrects that: more staff shortens the queue
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
      id: "V2",
      nodes: [
        { id: "customers", label: "Customers" },
        { id: "queue", label: "Queue length" },
        { id: "customer-satisfaction", label: "Customer satisfaction" },
      ],
      edges: [
        { id: "customers-queue", source: "customers", target: "queue", polarity: "positive" },
        { id: "queue-satisfaction", source: "queue", target: "customer-satisfaction", polarity: "negative" },
        { id: "satisfaction-customers", source: "customer-satisfaction", target: "customers", polarity: "positive" },
      ],
    },
    {
      id: "V3",
      nodes: [
        { id: "customers", label: "Customers" },
        { id: "queue", label: "Queue length" },
        { id: "customer-satisfaction", label: "Customer satisfaction" },
        { id: "revenue", label: "Revenue" },
      ],
      edges: [
        { id: "customers-queue", source: "customers", target: "queue", polarity: "positive" },
        { id: "queue-satisfaction", source: "queue", target: "customer-satisfaction", polarity: "negative" },
        { id: "satisfaction-customers", source: "customer-satisfaction", target: "customers", polarity: "positive" },
        { id: "customers-revenue", source: "customers", target: "revenue", polarity: "positive" },
      ],
    },
    {
      id: "V4",
      nodes: [
        { id: "customers", label: "Customers" },
        { id: "queue", label: "Queue length" },
        { id: "customer-satisfaction", label: "Customer satisfaction" },
        { id: "revenue", label: "Revenue" },
        { id: "staff", label: "Staff on shift" },
      ],
      edges: [
        { id: "customers-queue", source: "customers", target: "queue", polarity: "positive" },
        { id: "queue-satisfaction", source: "queue", target: "customer-satisfaction", polarity: "negative" },
        { id: "satisfaction-customers", source: "customer-satisfaction", target: "customers", polarity: "positive" },
        { id: "customers-revenue", source: "customers", target: "revenue", polarity: "positive" },
        { id: "revenue-staff", source: "revenue", target: "staff", polarity: "positive" },
        { id: "staff-queue", source: "staff", target: "queue", polarity: "positive" },
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
        {
          id: "customers-queue",
          source: "customers",
          target: "queue",
          polarity: "positive",
          evidence: [
            { text: "The line doubles in the morning rush", contributor: "barista" },
            { text: "Busy days mean longer waits", contributor: "manager" },
          ],
        },
        {
          id: "queue-satisfaction",
          source: "queue",
          target: "customer-satisfaction",
          polarity: "negative",
          evidence: [{ text: "People sigh at the door when the line is long", contributor: "barista" }],
        },
        {
          id: "satisfaction-customers",
          source: "customer-satisfaction",
          target: "customers",
          polarity: "positive",
          evidence: [{ text: "Regulars bring their friends", contributor: "manager" }],
        },
        {
          id: "customers-revenue",
          source: "customers",
          target: "revenue",
          polarity: "positive",
          evidence: [{ contributor: "manager" }],
        },
        {
          id: "revenue-staff",
          source: "revenue",
          target: "staff",
          polarity: "positive",
          evidence: [{ text: "We hire when the till is good", contributor: "manager" }],
        },
        {
          id: "staff-queue",
          source: "staff",
          target: "queue",
          polarity: "negative",
          evidence: [
            { text: "A second person on the till halves the wait", contributor: "barista" },
            { contributor: "manager" },
          ],
        },
      ],
    },
  ],
  // Later versions keep their ids, so only the rename needs saying. V1 → final says it too, so
  // the two can be compared directly
  correspondences: [
    {
      from: "V1",
      to: "V2",
      nodes: {
        customers: "customers",
        queue: "queue",
        satisfaction: "customer-satisfaction",
      },
    },
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
