'use server';
/**
 * @fileOverview AI tool to manage water pump activation based on soil moisture levels, with dynamic threshold adjustments.
 *
 * - automateIrrigation - A function that handles the water pump automation process.
 * - AutomateIrrigationInput - The input type for the automateIrrigation function.
 * - AutomateIrrigationOutput - The return type for the automateIrrigation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutomateIrrigationInputSchema = z.object({
  soilMoisture: z.number().describe('The current soil moisture level (percentage).'),
  optimalMoisture: z.number().describe('The optimal soil moisture level (percentage).'),
  pumpStatus: z.boolean().describe('The current status of the water pump (true for ON, false for OFF).'),
});
export type AutomateIrrigationInput = z.infer<typeof AutomateIrrigationInputSchema>;

const AutomateIrrigationOutputSchema = z.object({
  newPumpStatus: z.boolean().describe('The recommended new status of the water pump (true for ON, false for OFF).'),
  reason: z.string().describe('The reason for the recommended pump status change.'),
});
export type AutomateIrrigationOutput = z.infer<typeof AutomateIrrigationOutputSchema>;

export async function automateIrrigation(input: AutomateIrrigationInput): Promise<AutomateIrrigationOutput> {
  return automateIrrigationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'automateIrrigationPrompt',
  input: {schema: AutomateIrrigationInputSchema},
  output: {schema: AutomateIrrigationOutputSchema},
  prompt: `You are an AI assistant designed to control a greenhouse water pump based on soil moisture levels.

You will receive the current soil moisture level, the optimal soil moisture level, and the current pump status.

Your task is to determine whether the water pump should be turned ON or OFF, and provide a reason for your decision.

Here's the current data:
Soil Moisture: {{soilMoisture}}%
Optimal Moisture: {{optimalMoisture}}%
Current Pump Status: {{#if pumpStatus}}ON{{else}}OFF{{/if}}

Consider these factors:
- If the soil moisture is significantly below the optimal level, turn the pump ON.
- If the soil moisture is at or above the optimal level, turn the pump OFF.
- If the pump is already ON and the soil moisture is still below the optimal level, keep it ON.
- If the pump is already OFF and the soil moisture is above the optimal level, keep it OFF.
`,
});

const automateIrrigationFlow = ai.defineFlow(
  {
    name: 'automateIrrigationFlow',
    inputSchema: AutomateIrrigationInputSchema,
    outputSchema: AutomateIrrigationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
