import { z } from 'zod';

const uuidArgSchema = z.object({
  id: z.string().uuid('id must be a valid uuid'),
});

type UuidArg = z.infer<typeof uuidArgSchema>;

export { UuidArg, uuidArgSchema };
