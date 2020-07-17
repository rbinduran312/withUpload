const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../../middleware/auth');
const config = require('config');
const { check, validationResult } = require('express-validator');

const User = require('../../models/User');

const { authenticateUser } = require('./../../util/cognito')

// @route    GET api/auth
// @desc     Get user by token
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findOne({ cogid: req.user.cogid }).select('-password').select('-cogid');
    if ( ! user ) return res.status(401).send('Unauthenticated')
    res.json({...user.toObject(), ...( req.user.new_tokens && { new_tokens: req.user.new_tokens } )});
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/auth
// @desc     Authenticate user & get token
// @access   Public
router.post(
  '/',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      let user = await User.findOne({ email });

      if (!user) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'Invalid Credentials' }] });
      }

      const [ token, error ] = await authenticateUser(email, password)
        .then(token => [ token, null ])
        .catch(error => [ null, error ])
      if ( error || ! token )
        return res
          .status(400)
          .json({ errors: [{ msg: String(error).replace(/username/gi, 'email') }] })

      return res.json({ token })
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;
