// Shield App Database Service
// Centralized database operations

export * from './profiles';
export * from './venues';
export * from './personnel';
export * from './agencies';
export * from './bookings';
export * from './shifts';
export * from './availability';
export * from './documents';
export * from './notifications';
export * from './assignment';
export * from './payments';
export * from './reviews';
export * from './agency-shifts';
export * from './cancellation';

// `assignment` and `agency-shifts` both export `AssignmentResult`; the explicit
// re-export below disambiguates the wildcard conflict in favour of `assignment`.
export type { AssignmentResult } from './assignment';