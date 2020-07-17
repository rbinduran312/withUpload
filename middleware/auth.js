const jwt = require('jsonwebtoken');
const config = require('config');

const { tokenValidator } = require('./../util/cognito')

module.exports = async function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    token_data = JSON.parse(Buffer.from(token, 'base64').toString())
    const { sub: cogid, _refresh_session: new_tokens } = await tokenValidator(token_data)
    req.user = { cogid, ...(new_tokens && { new_tokens }) }

    if ( req.user.cogid ) {
      const user = await User.findOne({ cogid: req.user.cogid }).select('-password')

      if ( user ) {
        req.user = { ...user.toObject(), ...req.user, id: user._id.toString() }
      }
    }

    req.cognito_tokens = new_tokens ? JSON.parse(Buffer.from(new_tokens, 'base64').toString()) : null
    req.cognito_tokens = req.cognito_tokens || token_data

    next()
  } catch (err) {
    console.log(`cognito.tokenValidator ended with an error: ${err}`)
    res.status(500).json({ msg: 'Server Error' });
  }
};
