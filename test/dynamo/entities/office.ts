import { Entity } from "electrodb";

export const Office = new Entity({
  model: {
    entity: "office",
    version: "1",
    service: "taskapp",
  },
  attributes: {
    office: {
      type: "string",
    },
    country: {
      type: "string",
    },
    state: {
      type: "string",
    },
    city: {
      type: "string",
    },
    zip: {
      type: "string",
    },
    address: {
      type: "string",
    },
  },
  indexes: {
    locations: {
      pk: {
        field: "pk",
        composite: ["country", "state"],
      },
      sk: {
        field: "sk",
        composite: ["city", "zip", "office"],
      },
    },
    office: {
      index: "gsi1",
      collection: "workplaces",
      pk: {
        field: "gsi1pk",
        composite: ["office"],
      },
      sk: {
        field: "gsi1sk",
        composite: [],
      },
    },
  },
});
