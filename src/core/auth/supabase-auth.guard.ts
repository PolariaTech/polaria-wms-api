import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/** @deprecated Usar JwtAuthGuard directamente. */
@Injectable()
export class SupabaseAuthGuard extends JwtAuthGuard {}
