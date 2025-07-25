'use server';
/**
 * @fileOverview AI tool to analyze the impact of environmental factors on a crop.
 *
 * - getEnvironmentalImpact - A function that analyzes environmental data for a crop.
 * - EnvironmentalImpactInput - The input type for the getEnvironmentalImpact function.
 * - EnvironmentalImpactOutput - The return type for the getEnvironmentalImpact function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnvironmentalImpactInputSchema = z.object({
  temperature: z.number().describe('The current temperature in Celsius.'),
  humidity: z.number().describe('The current humidity percentage.'),
  soilMoisture: z.number().describe('The current soil moisture percentage.'),
  crop: z.string().describe('The name of the crop being analyzed.'),
});
export type EnvironmentalImpactInput = z.infer<typeof EnvironmentalImpactInputSchema>;

const EnvironmentalImpactOutputSchema = z.object({
  impactAnalysis: z.string().describe('A concise analysis of how the current environmental conditions are affecting the specified crop.'),
});
export type EnvironmentalImpactOutput = z.infer<typeof EnvironmentalImpactOutputSchema>;

export async function getEnvironmentalImpact(input: EnvironmentalImpactInput): Promise<EnvironmentalImpactOutput> {
  return environmentalImpactFlow(input);
}

const prompt = ai.definePrompt({
  name: 'environmentalImpactPrompt',
  input: {schema: EnvironmentalImpactInputSchema},
  output: {schema: EnvironmentalImpactOutputSchema},
  prompt: `You are an agricultural AI assistant.
  Analyze the following environmental data for the specified crop and provide a concise, insightful analysis of the impact on the crop's health and growth.
  Focus on whether the conditions are optimal, and if not, what the potential impact is.

  Crop: {{{crop}}}
  Temperature: {{temperature}}°C
  Humidity: {{humidity}}%
  Soil Moisture: {{soilMoisture}}%

  Provide a single, clear sentence for the analysis. For example: "The current high temperature and low humidity may be stressing the Tomatoes, potentially slowing fruit development."
  `,
});

const environmentalImpactFlow = ai.defineFlow(
  {
    name: 'environmentalImpactFlow',
    inputSchema: EnvironmentalImpactInputSchema,
    outputSchema: EnvironmentalImpactOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
