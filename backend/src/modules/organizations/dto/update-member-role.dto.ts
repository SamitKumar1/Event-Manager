import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @IsEnum(OrganizationRole)
  @IsNotEmpty()
  role!: OrganizationRole;
}