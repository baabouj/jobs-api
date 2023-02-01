import { JobTypes } from '@prisma/client';
import { z } from 'zod';

import { uuidArgSchema } from './uuid.validation';

const jobSchema = z.object({
  title: z.string().min(1, 'job title must not be empty'),
  description: z.string().min(1, 'job description must not be empty'),
  type: z.nativeEnum(JobTypes, {
    errorMap: () => ({
      message: `job type must be either ${Object.values(JobTypes).join(' or ')}`,
    }),
  }),
  applicationLink: z
    .string()
    .min(1, 'job application link must not be empty')
    .url('job application link must be a valid url'),
});

const createJobSchema = z.object({
  job: jobSchema,
});

const updateJobSchema = z
  .object({
    job: jobSchema.partial(),
  })
  .merge(uuidArgSchema);

type CreateJobArgs = z.infer<typeof createJobSchema>;
type UpdateJobArgs = z.infer<typeof updateJobSchema>;

type Job = z.infer<typeof jobSchema>;

export { CreateJobArgs, createJobSchema, Job, UpdateJobArgs, updateJobSchema };
