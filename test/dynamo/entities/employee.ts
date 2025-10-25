import { Entity } from "electrodb";

export const Employee = new Entity({
  model: {
    entity: "employee",
    version: "1",
    service: "taskapp",
  },
  attributes: {
    employee: {
      type: "string",
    },
    firstName: {
      type: "string",
    },
    lastName: {
      type: "string",
    },
    office: {
      type: "string",
    },
    title: {
      type: "string",
    },
    team: {
      type: ["development", "marketing", "finance", "product"] as const,
    },
    salary: {
      type: "string",
    },
    manager: {
      type: "string",
    },
    dateHired: {
      type: "string",
    },
    birthday: {
      type: "string",
    },
  },
  indexes: {
    employee: {
      pk: {
        field: "pk",
        composite: ["employee"],
      },
      sk: {
        field: "sk",
        composite: [],
      },
    },
    coworkers: {
      index: "gsi1",
      collection: "workplaces",
      pk: {
        field: "gsi1pk",
        composite: ["office"],
      },
      sk: {
        field: "gsi1sk",
        composite: ["team", "title", "employee"],
      },
    },
    teams: {
      index: "gsi2",
      pk: {
        field: "gsi2pk",
        composite: ["team"],
      },
      sk: {
        field: "gsi2sk",
        composite: ["title", "salary", "employee"],
      },
    },
    employeeLookup: {
      collection: "assignments",
      index: "gsi3",
      pk: {
        field: "gsi3pk",
        composite: ["employee"],
      },
      sk: {
        field: "gsi3sk",
        composite: [],
      },
    },
    roles: {
      index: "gsi4",
      pk: {
        field: "gsi4pk",
        composite: ["title"],
      },
      sk: {
        field: "gsi4sk",
        composite: ["salary", "employee"],
      },
    },
    directReports: {
      index: "gsi5",
      pk: {
        field: "gsi5pk",
        composite: ["manager"],
      },
      sk: {
        field: "gsi5sk",
        composite: ["team", "office", "employee"],
      },
    },
  },
});
