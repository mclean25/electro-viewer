import { Entity } from 'electrodb';

const UserEntity = new Entity({
  model: {
    entity: 'User',
    version: '1',
    service: 'myservice',
    table: 'MyTable',
  },
  attributes: {
    userId: {
      type: 'string',
      required: true,
    },
    email: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
    },
    companyId: {
      type: 'string',
      required: true,
    },
    createdAt: {
      type: 'string',
      default: () => new Date().toISOString(),
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'pk',
        composite: ['companyId'],
      },
      sk: {
        field: 'sk',
        composite: ['userId'],
      },
    },
    byEmail: {
      index: 'gsi1',
      pk: {
        field: 'gsi1pk',
        composite: ['email'],
      },
      sk: {
        field: 'gsi1sk',
        composite: ['userId'],
      },
    },
  },
});

export const entities = {
  User: UserEntity,
};