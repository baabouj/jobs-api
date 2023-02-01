import companyResolver from './company.resolver';
import jobResolver from './job.resolver';
import mutationResolver from './mutation.resolver';
import queryResolver from './query.resolver';

export default {
  Query: queryResolver,
  Mutation: mutationResolver,
  Company: companyResolver,
  Job: jobResolver,
};
