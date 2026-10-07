import { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  requestPasswordReset as serviceRequestReset,
  resetPassword as serviceResetPassword,
} from '../services/auth.service';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await registerUser(req.body);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, refreshToken, user } = await loginUser(req.body);
    res.json({ token, refreshToken, user });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await logoutUser(req.user!.sub);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await serviceRequestReset(req.body.email);
    // Always respond 200 – avoids leaking whether the email exists
    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await serviceResetPassword(req.body.token, req.body.newPassword);
    res.json({ message: 'Password has been reset' });
  } catch (err) {
    next(err);
  }
};

