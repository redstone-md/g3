import { type NextRequest, NextResponse } from "next/server";
import { adminUserCountExcludingRole, grantsAdmin } from "@/lib/admin-guard";
import { authorize } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sanitizePermissions } from "@/lib/permissions";
import { ancestorIds, toRoleMap } from "@/lib/role-permissions";
import { roleSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { user: actor, error } = await authorize("roles.update");
  if (error) return error;

  const { id } = await params;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role)
    return NextResponse.json({ error: "Role not found." }, { status: 404 });

  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role data." }, { status: 422 });
  }

  // System roles keep their name (referenced in code/seed/SSO) but their
  // permissions are editable.
  const name = role.isSystem ? role.name : parsed.data.name;
  const nextPermissions = sanitizePermissions(parsed.data.permissions);

  // Resolve inheritance: only existing roles, no self, no cycles.
  const allRoles = await prisma.role.findMany({
    select: { id: true, permissions: true, parentIds: true },
  });
  const validIds = new Set(allRoles.map((r) => r.id));
  const requestedParents = [...new Set(parsed.data.parentIds)].filter(
    (pid) => validIds.has(pid) && pid !== id,
  );
  // A cycle would exist if this role is an ancestor of any chosen parent.
  const reachable = ancestorIds(requestedParents, toRoleMap(allRoles));
  if (reachable.has(id)) {
    return NextResponse.json(
      { error: "That would create a circular inheritance." },
      { status: 400 },
    );
  }
  const parentIds = requestedParents;

  // Block stripping admin from a role if it would leave zero admins anywhere.
  if (grantsAdmin(role.permissions) && !grantsAdmin(nextPermissions)) {
    const membersInRole = await prisma.user.count({
      where: { roleIds: { has: id } },
    });
    const adminsElsewhere = await adminUserCountExcludingRole(id);
    if (membersInRole > 0 && adminsElsewhere === 0) {
      return NextResponse.json(
        {
          error:
            "Removing admin access from this role would leave the system with no administrators.",
        },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await prisma.role.update({
      where: { id },
      data: {
        name,
        description: parsed.data.description || null,
        permissions: nextPermissions,
        parentIds,
      },
    });
    await logAudit({
      action: "role.update",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "role",
      targetId: id,
      metadata: { name: updated.name },
    });
    return NextResponse.json({ id: updated.id });
  } catch {
    return NextResponse.json(
      { error: "A role with that name already exists." },
      { status: 409 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { user: actor, error } = await authorize("roles.delete");
  if (error) return error;

  const { id } = await params;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role)
    return NextResponse.json({ error: "Role not found." }, { status: 404 });
  if (role.isSystem) {
    return NextResponse.json(
      { error: "System roles cannot be deleted." },
      { status: 403 },
    );
  }

  // Detach members first (Mongo m-n keeps ids on both sides; no FK cascade).
  await prisma.role.update({ where: { id }, data: { users: { set: [] } } });
  await prisma.role.delete({ where: { id } });
  await logAudit({
    action: "role.delete",
    actorId: actor.id,
    actorEmail: actor.email,
    targetType: "role",
    targetId: id,
    metadata: { name: role.name },
  });
  return NextResponse.json({ id });
}
