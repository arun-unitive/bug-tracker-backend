import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI not found in .env');
    }
    
    await mongoose.connect(uri);
    console.log('MongoDB Connected for seeding...');

    // Clear existing admin user if any
    await User.deleteMany({ email: 'admin@bugtracker.com' });

    const adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@bugtracker.com',
      password: 'adminpassword123',
      role: 'Admin',
    });

    console.log('Initial Admin User Created successfully.');
    console.log('Email: admin@bugtracker.com');
    console.log('Password: adminpassword123');

    process.exit();
  } catch (error) {
    console.error(`Error seeding admin: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
