import { useEffect } from "react";

interface UseIdentityPageEffectsParams {
  loadCurrentMachineIds: () => Promise<void>;
}

export function useIdentityPageEffects({
  loadCurrentMachineIds,
}: UseIdentityPageEffectsParams) {
  useEffect(() => {
    void loadCurrentMachineIds();
  }, [loadCurrentMachineIds]);
}
