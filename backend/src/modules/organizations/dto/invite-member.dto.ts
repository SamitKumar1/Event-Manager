import { IsNotEmpty, IsEmail, IsEnum } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsEnum(OrganizationRole)
  @IsNotEmpty()
  role!: OrganizationRole;
}