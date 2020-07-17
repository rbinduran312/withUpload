const express = require('express');
const router = express.Router();
const gravatar = require('gravatar');
const bcrypt = require('bcryptjs');
const config = require('config');
const { check, validationResult } = require('express-validator');
const normalize = require('normalize-url');

const User = require('../../models/User');

const { signupUser, authenticateUser } = require('./../../util/cognito')

// @route    POST api/users
// @desc     Register user
// @access   Public
router.post(
  '/',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check(
      'password',
      'Please enter a password with 6 or more characters'
    ).isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
      let user = await User.findOne({ email });

      if (user) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'User already exists' }] });
      }

      const avatar = normalize(
        gravatar.url(email, {
          s: '200',
          r: 'pg',
          d: 'mm'
        }),
        { forceHttps: true }
      );

      const [ cog_user, signup_error ] = await signupUser(email, password)

      if ( signup_error || ! cog_user )
        return res
          .status(400)
          .json({ errors: [{ msg: String(signup_error) }] })

      user = new User({
        name,
        email,
        avatar,
        cogid: cog_user.userSub,
      });

      await user.save();

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
