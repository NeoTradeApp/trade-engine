//  v1 api
const { timesheetDocs } = require('../v1/timesheetDocs');

//  v1 api path and defination
const { paths: userPaths, definitions: userDefinitions } = timesheetDocs;

const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    version: '3.0.3',
    title: 'Timesheet Server APIs v1',
    description: "Documentation of Timesheet Server Api's v1",
  },
  servers: [
    {
      url: 'http://localhost:9000',
      description: 'local',
    }, {
      url: 'http://localhost:9000/api',
      description: 'local',
    },
    ...process.env.NODE_ENV === 'production'
      ? [
          {
            url: '',
            description: 'Prod',
          },
        ]
      : [
          {
            url: 'http://localhost:9000',
            description: 'dev',
          },
        ],
  ],
  tags: [
    {
      name: 'Health',
      description: 'API to check if server is up and running.',
    },
    {
      name: 'Timesheets',
      description: 'API to Access and update timesheets',
    },
  ],
  components: {
    securitySchemes: {
      clientid: {
        type: 'apiKey',
        name: 'clientid',
        in: 'header',
      },
      clientsecret: {
        type: 'apiKey',
        name: 'clientsecret',
        in: 'header',
      },
      authtoken: {
        type: 'apiKey',
        name: 'authtoken',
        in: 'header',
      },
    },
  },
  security: [
    {
      clientid: [],
    },
    {
      clientsecret: [],
    },
    {
      authtoken: [],
    },
  ],
  schemes: ['https', 'http'],
  consumes: ['application/json'],
  produces: ['application/json'],
  paths: {
    ...userPaths,
  },
  definitions: {
    ...userDefinitions,
  },
};

module.exports = {
  swaggerDocument,
};
