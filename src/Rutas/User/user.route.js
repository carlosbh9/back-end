const express = require('express');
const router = express.Router();
const User = require('../../../src/models/user.schema');
const jwt = require('jsonwebtoken');



  // Registro
router.post('/signup', async (req, res) => {
    const { username, password, role ,name} = req.body;
    try {
        const temp = new User({ username, password, role ,name});
        await temp.save();
        const token = jwt.sign({_id: temp._id,},'secretKey')
        res.status(200).json({ usuario: temp ,message: 'Usuario registrado',token: token });
    } catch (error) {
        res.status(400).send(error);
    }
});
// Login
router.post('/login',  async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'usuario inválido' });
  
    if (user.password != password) return res.status(401).json({ error: 'contraseña inválida' });
    // const isPasswordValid = await bcrypt.compare(password, user.password);
    // if (!isPasswordValid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign({ id: user._id , role: user.role, username: user.name}, 'secretKey');
    //const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ token });
  });

  module.exports = router;

