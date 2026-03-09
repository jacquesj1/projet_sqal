import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080',
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'gaveurs-production',
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'gaveurs-frontend',
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
