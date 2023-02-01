import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('email must be a valid email address'),
  password: z.string().min(8),
});

const signupSchema = z.object({
  company: z
    .object({
      name: z.string().min(3),
      website: z.string().url('website must be a valid url'),
      headquarter: z.string().min(3),
      logo: z.string().url('logo must be a valid url'),
      description: z.string().min(3),
      email: z.string().email('email must be a valid email address'),
      password: z
        .string({
          required_error: 'password is required',
        })
        .min(8, 'password must be more than 8 characters')
        .max(64, 'password must be less than 64 characters'),
      confirm: z
        .string({
          required_error: 'confirm password is required',
        })
        .min(8, 'confirm password must be more than 8 characters')
        .max(64, 'confirm password must be less than 64 characters'),
    })
    .refine((data) => data.password === data.confirm, {
      message: "passwords don't match",
      path: ['confirm'],
    }),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('email must be a valid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

type LoginArgs = z.infer<typeof loginSchema>;
type SignupArgs = z.infer<typeof signupSchema>;
type ChangePasswordArgs = z.infer<typeof changePasswordSchema>;
type ForgotPasswordArgs = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordArgs = z.infer<typeof resetPasswordSchema>;

export {
  ChangePasswordArgs,
  changePasswordSchema,
  ForgotPasswordArgs,
  forgotPasswordSchema,
  LoginArgs,
  loginSchema,
  ResetPasswordArgs,
  resetPasswordSchema,
  SignupArgs,
  signupSchema,
};
