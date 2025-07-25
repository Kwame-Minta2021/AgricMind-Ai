// src/ai/flows/best-practices.ts
'use server';
/**
 * @fileOverview Provides best practices for a given crop, including watering schedules and soil health notes.
 *
 * - getCropBestPractices - A function that retrieves best practices for a crop.
 * - CropBestPracticesInput - The input type for the getCropBestPractices function.
 * - CropBestPracticesOutput - The return type for the getCropBestPractices function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CropBestPracticesInputSchema = z.object({
  crop: z.string().describe('The name of the crop to get best practices for.'),
});
export type CropBestPracticesInput = z.infer<typeof CropBestPracticesInputSchema>;

const CropBestPracticesOutputSchema = z.object({
  watering: z.string().describe('Detailed watering schedule and advice.'),
  soil: z.string().describe('Notes and recommendations for soil health.'),
  general: z.string().describe('General best practices and tips for growing the crop.'),
});
export type CropBestPracticesOutput = z.infer<typeof CropBestPracticesOutputSchema>;

export async function getCropBestPractices(input: CropBestPracticesInput): Promise<CropBestPracticesOutput> {
  return cropBestPracticesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cropBestPracticesPrompt',
  input: {schema: CropBestPracticesInputSchema},
  output: {schema: CropBestPracticesOutputSchema},
  prompt: `You are an expert agricultural advisor. Provide the best practices for growing the following crop.
  Structure your advice into three sections: "watering", "soil", and "general".
  Do not use any markdown formatting. Write in clear, concise language.

  Crop: {{{crop}}}`,
});

const cropBestPracticesFlow = ai.defineFlow(
  {
    name: 'cropBestPracticesFlow',
    inputSchema: CropBestPracticesInputSchema,
    outputSchema: CropBestPracticesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
