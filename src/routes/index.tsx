import { createFileRoute } from "@tanstack/react-router";
import { KevinApp } from "@/components/KevinApp";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <KevinApp />;
}
