import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findById(id: string) {
    return this.usersRepository.findById(id);
  }

  findByEmailForAuthentication(email: string) {
    return this.usersRepository.findByEmailForAuthentication(
      this.normalizeEmail(email),
    );
  }

  create(email: string, passwordHash: string) {
    return this.usersRepository.create(
      this.normalizeEmail(email),
      passwordHash,
    );
  }

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
