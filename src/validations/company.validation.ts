import { z } from 'zod';

const companyArgsSchema = z.object({
  id: z.string().uuid('company id must be a valid uuid'),
});

const updateCompanyArgsSchema = z.object({
  company: z
    .object({
      name: z.string().min(3),
      website: z.string().url('website must be a valid url'),
      headquarter: z.string().min(3),
      logo: z.string().url('logo must be a valid url'),
      description: z.string().min(3),
    })
    .partial(),
});

type CompanyArgs = z.infer<typeof companyArgsSchema>;
type UpdateCompanyArgs = z.infer<typeof updateCompanyArgsSchema>;

export { CompanyArgs, companyArgsSchema, UpdateCompanyArgs, updateCompanyArgsSchema };
