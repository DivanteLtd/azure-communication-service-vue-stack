import  { CommunicationIdentityClient } from '@azure/communication-administration';

export const issueAccessToken = async () => {
    const connectionString = process.env['COMMUNICATION_SERVICES_CONNECTION_STRING'];
    const identityClient = new CommunicationIdentityClient(connectionString);
    let identityResponse = await identityClient.createUser();
    let tokenResponse = await identityClient.issueToken(identityResponse, ["voip"]);
    const { token, expiresOn } = tokenResponse;

    return {"token":token, "user_id":identityResponse.communicationUserId, "expires_at":expiresOn};
};