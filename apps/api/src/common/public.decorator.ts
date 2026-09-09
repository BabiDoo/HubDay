import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'hubday:isPublic';

/** Marks a route as reachable without a bearer token (health, login, docs). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
