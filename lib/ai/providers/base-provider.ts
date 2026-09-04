import { InvestigationRequest, InvestigationResult } from "../types";

export interface IAiProvider {
  name: string;
  isAvailable(): boolean;
  investigate(request: InvestigationRequest): Promise<InvestigationResult>;
}
