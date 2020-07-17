const AmazonCognitoIdentity = require('amazon-cognito-identity-js')
const poolData = {
  UserPoolId: require('config').cognitoPoolId,
  ClientId: require('config').cognitoClientId,
}
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData)

const signupUser = (email, password) =>
{
  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: 'email',
      Value: email,
    })
  ]

  if ( ! global.fetch ) {
    global.fetch = require('node-fetch')
  }

  return new Promise((resolve) => userPool.signUp(email, password, attributeList, null, (err, result) =>
  {
    if ( err ) {
      return resolve([null, err.message || JSON.stringify(err)])
    }

    return resolve([result, null])
  }))
}

const authenticateUser = (email, password) => new Promise((resolve, reject) =>
{
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: email,
    Pool: userPool,
  }), authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: email,
    Password: password,
  })

  if ( ! global.fetch ) {
    global.fetch = require('node-fetch')
  }

  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: (result) => {
      console.log('access token ', result.getAccessToken().getJwtToken())
      console.log('id token ', result.getIdToken().getJwtToken())
      console.log('refresh token ', result.getRefreshToken().getJwtToken())
      resolve(Buffer.from(JSON.stringify({
        access_token: result.getAccessToken().getJwtToken(),
        id_token: result.getIdToken().getJwtToken(),
        refresh_token: result.getRefreshToken().getToken(),
        email,
      })).toString('base64'))

    },
    onFailure: err => reject(err.message || JSON.stringify(err)),
  })
})

const tokenValidator = async (token) =>
{
  const { access_token, id_token, refresh_token, email: user_email } = token

  const response = await require('node-fetch')(
    `https://cognito-idp.${require('config').cognitoPoolRegion}.amazonaws.com/${poolData.UserPoolId}/.well-known/jwks.json`
  ).then(res => res.json())

  const [jwt, jwkToPem] = [require('jsonwebtoken'), require('jwk-to-pem')]

  const pems = {}
  const keys = response.keys
  
  for ( let i = 0; i < keys.length; i++ ) {
    pems[keys[i].kid] = jwkToPem({ kty: keys[i].kty, n: keys[i].n, e: keys[i].e })
  }
  
  const decodedJwt = jwt.decode(access_token, { complete: true })
  
  if ( ! decodedJwt ) {
    throw new Error(`Not a valid JWT token ${decodedJwt}`)
  }
  
  const kid = decodedJwt.header.kid
  const pem = pems[kid]
  
  if ( ! pem ) {
    throw new Error('Invalid token')
  }

  return new Promise((resolve, reject) => jwt.verify(access_token, pem, (err, payload) =>
  {
    const AccessToken = new AmazonCognitoIdentity.CognitoAccessToken({AccessToken: access_token})
    const IdToken = new AmazonCognitoIdentity.CognitoIdToken({IdToken: id_token})
    const RefreshToken = new AmazonCognitoIdentity.CognitoRefreshToken({RefreshToken: refresh_token})
    const cachedSession = new AmazonCognitoIdentity.CognitoUserSession({
      IdToken: IdToken,
      AccessToken: AccessToken,
      RefreshToken: RefreshToken
    })

    if ( err || ! cachedSession.isValid() ) {
      cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: user_email,
        Pool: userPool,
      })

      if ( ! global.fetch ) {
        global.fetch = require('node-fetch')
      }

      cognitoUser.refreshSession(RefreshToken, (err, session) =>
      {
        if ( err )
          return reject(`Refreshing session ended with an error: ${err}`)

        const new_token = {
          access_token: session.getAccessToken().getJwtToken(),
          id_token: session.getIdToken().getJwtToken(),
          refresh_token: session.getRefreshToken().getToken()
        }

        cognitoUser.getUserData((err, userData) =>
        {
          if ( err )
            return reject(`Refreshing session ended with an error (cognitoUser.getUserData): ${err}`)

          const cogid = (userData.UserAttributes.find(x => x.Name = 'sub')||{}).Value

          if ( ! cogid )
            return reject(`Refreshing session ended with an error (cognitoUser.getUserData): failed to get userSub`)

          return resolve({
            _refresh_session: Buffer.from(JSON.stringify({ ...new_token, email: user_email })).toString('base64'),
            sub: cogid,
          })
        })
      })
    } else {
      resolve(payload)
    }
  }))
}

const deleteUser = (token) => new Promise((resolve, reject) =>
{
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: token.email,
    Pool: userPool,
  })

  if ( ! global.fetch ) {
    global.fetch = require('node-fetch')
  }

  cognitoUser.refreshSession(
    new AmazonCognitoIdentity.CognitoRefreshToken({RefreshToken: token.refresh_token})
    , (err, session) =>
  {
    if ( err )
      return reject(err)

    cognitoUser.deleteUser((err, result) =>
    {
      if ( err )
        return reject(err.message || JSON.stringify(err))

      return resolve(result)
    })
  })
})

module.exports = {
  AmazonCognitoIdentity,
  userPool,
  signupUser,
  authenticateUser,
  tokenValidator,
  deleteUser,
}