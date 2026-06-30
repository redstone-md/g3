"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { ForbiddenView } from "@/components/dashboard/forbidden-view";
import { ObjectsView } from "@/components/objects/objects-view";

function ObjectsInner() {
  const user = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const bucketId = searchParams.get("bucket") ?? "";

  if (!user.permissions.includes("storage.read")) return <ForbiddenView />;
  if (!bucketId) {
    router.replace("/dashboard/buckets");
    return null;
  }
  return <ObjectsView bucketId={bucketId} permissions={user.permissions} />;
}

export default function ObjectsPage() {
  return (
    <Suspense>
      <ObjectsInner />
    </Suspense>
  );
}
