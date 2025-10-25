import { Entity } from "electrodb";

export const Task = new Entity({
  model: {
    entity: "task",
    version: "1",
    service: "taskapp",
  },
  attributes: {
    task: {
      type: "string",
      required: true,
    },
    project: {
      type: "string",
      required: true,
    },
    employee: {
      type: "string",
      required: true,
    },
    description: {
      type: "string",
      required: true,
    },
  },
  indexes: {
    task: {
      pk: {
        field: "pk",
        composite: ["task"],
      },
      sk: {
        field: "sk",
        composite: ["project", "employee"],
      },
    },
    project: {
      index: "gsi1",
      pk: {
        field: "gsi1pk",
        composite: ["project"],
      },
      sk: {
        field: "gsi1sk",
        composite: ["employee", "task"],
      },
    },
    assigned: {
      collection: "assignments",
      index: "gsi3",
      pk: {
        field: "gsi3pk",
        composite: ["employee"],
      },
      sk: {
        field: "gsi3sk",
        composite: ["project", "task"],
      },
    },
  },
});
