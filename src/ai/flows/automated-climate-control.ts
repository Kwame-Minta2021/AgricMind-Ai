'use server';
/**
 * @fileOverview AI tool to manage the grow light based on temperature and humidity.
 *
 * - automateClimate - A function that handles the climate control automation.
 * - AutomateClimateInput - The input type for the automateClimate function.
 * - AutomateClimateOutput - The return type for the automateClimate function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutomateClimateInputSchema = z.object({
  temperature: z.number().describe('The current temperature in Celsius.'),
  humidity: z.number().describe('The current humidity percentage.'),
  bulbStatus: z.boolean().describe('The current status of the grow light (true for ON, false for OFF).'),
});
export type AutomateClimateInput = z.infer<typeof AutomateClimateInputSchema>;

const AutomateClimateOutputSchema = z.object({
  newBulbStatus: z.boolean().describe('The recommended new status of the grow light (true for ON, false for OFF).'),
  reason: z.string().describe('The reason for the recommended light status change.'),
});
export type AutomateClimateOutput = z.infer<typeof AutomateClimateOutputSchema>;

export async function automateClimate(input: AutomateClimateInput): Promise<AutomateClimateOutput> {
  return automateClimateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'automateClimatePrompt',
  input: {schema: AutomateClimateInputSchema},
  output: {schema: AutomateClimateOutputSchema},
  prompt: `You are an AI assistant controlling a greenhouse grow light.

Your task is to decide if the light should be ON or OFF based on these rules:
- If the temperature is 33°C or higher AND the humidity is 85% or higher, the light must be turned OFF to reduce heat and stress.
- Otherwise, the light should be ON to support crop growth.

Current data:
Temperature: {{temperature}}°C
Humidity: {{humidity}}%
Current Bulb Status: {{#if bulbStatus}}ON{{else}}OFF{{/if}}

Determine the new bulb status and provide a clear reason for your decision.
`,
});

const automateClimateFlow = ai.defineFlow(
  {
    name: 'automateClimateFlow',
    inputSchema: AutomateClimateInputSchema,
    outputSchema: AutomateClimateOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
