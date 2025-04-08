const express = require('express');
const router = express.Router();
const User = require('../../models/user.schema');
const Role = require('../../models/roles.schema');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const JWT_SECRET = 'secretKey'
require('dotenv').config()
const  {authorize} = require('../../middlewares/auth');
const SALT_ROUNDS = 10;

// Registro
router.post('/signup', async (req, res) => {
    const { username, password, role ,name} = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }

        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALT_ROUNDS, 10));

        const temp = new User({ username, password: hashedPassword, role ,name});
        await temp.save();
        const token = jwt.sign({_id: temp._id,},process.env.JWT_SECRET)
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
  
     const isPasswordValid = await bcrypt.compare(password, user.password);
  
     if (!isPasswordValid) return res.status(401).json({ error: 'Credenciales inválidas' });
  
     const roleData = await Role.findOne({name: user.role}) 
     const permissions = roleData ? roleData.permissions : [];

     const token = jwt.sign({ id: user._id , role: user.role, username: user.name,email:user.username,permissions }, process.env.JWT_SECRET);

    //const tokenPermission = jwt.sign({roles: permissions}, process.env.JWT_SECRET)
    //const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ token});
  });

  router.delete('/delete-user/:id', async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) return res.status(404).json({ error: 'Usuario no encontrado' });

        res.status(200).json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar usuario', details: error });
    }
});

router.patch('/update-user/:id', async (req, res) => {
    const { name } = req.body;
    try {
        const updatedUser = await User.findByIdAndUpdate(req.params.id,req.body, { new: true, select: '-password' });
        //select: '-password' }
        if (!updatedUser) return res.status(404).json({ error: 'Usuario no encontrado' });

        res.status(200).json({ message: 'Usuario actualizado', usuario: updatedUser });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar usuario', details: error });
    }
});

router.get('/all-users', async (req, res) => {
    try {
        const users = await User.find(); // Excluir contraseñas de la respuesta
      //  const users = await User.find({}, '-password'); 
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios', details: error });
    }
});
  module.exports = router;

