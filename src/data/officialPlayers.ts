import type { Position } from '../types';

export interface OfficialPlayerSeed {
  name: string;
  primaryPosition: Position;
  secondaryPosition: Position | '';
  happyAnywhere: boolean;
  pace: number;
  stamina: number;
  dribbling: number;
  passing: number;
  finishing: number;
  defending: number;
  gameIQ: number;
  gkRating: number | null;
}

export const OFFICIAL_PLAYERS: OfficialPlayerSeed[] = [
  { name: 'Anshul Mittal', primaryPosition: 'DEF', secondaryPosition: '', happyAnywhere: false, pace: 7.5, stamina: 8.5, dribbling: 6.0, passing: 6.5, finishing: 5.5, defending: 8.0, gameIQ: 6.5, gkRating: 5.5 },
  { name: 'Aditya Bakshi', primaryPosition: 'GK', secondaryPosition: 'DEF', happyAnywhere: false, pace: 4.0, stamina: 4.0, dribbling: 3.0, passing: 3.0, finishing: 4.0, defending: 4.5, gameIQ: 3.5, gkRating: 5.0 },
  { name: 'Aditya Bhandari', primaryPosition: 'DEF', secondaryPosition: 'MID', happyAnywhere: true, pace: 6.5, stamina: 7.5, dribbling: 8.0, passing: 5.5, finishing: 6.5, defending: 7.5, gameIQ: 4.5, gkRating: 6.5 },
  { name: 'Dhruv', primaryPosition: 'DEF', secondaryPosition: 'FWD', happyAnywhere: false, pace: 4.5, stamina: 5.0, dribbling: 4.5, passing: 4.5, finishing: 5.0, defending: 5.5, gameIQ: 4.0, gkRating: 3.5 },
  { name: 'Shivesh', primaryPosition: 'DEF', secondaryPosition: 'MID', happyAnywhere: true, pace: 6.5, stamina: 5.0, dribbling: 8.0, passing: 7.0, finishing: 6.0, defending: 7.5, gameIQ: 7.5, gkRating: 6.5 },
  { name: 'Akshat Mittal', primaryPosition: 'GK', secondaryPosition: 'DEF', happyAnywhere: false, pace: 5.5, stamina: 6.0, dribbling: 3.5, passing: 4.5, finishing: 3.0, defending: 6.0, gameIQ: 4.0, gkRating: 7.0 },
  { name: 'Kartik Tripathi', primaryPosition: 'DEF', secondaryPosition: 'MID', happyAnywhere: false, pace: 5.0, stamina: 6.5, dribbling: 5.5, passing: 5.5, finishing: 6.0, defending: 7.0, gameIQ: 5.5, gkRating: 6.0 },
  { name: 'Paritosh Sinha', primaryPosition: 'GK', secondaryPosition: 'FWD', happyAnywhere: false, pace: 5.0, stamina: 4.0, dribbling: 3.0, passing: 4.0, finishing: 4.0, defending: 4.0, gameIQ: 4.0, gkRating: 7.5 },
  { name: 'Ayush Narang', primaryPosition: 'DEF', secondaryPosition: 'FWD', happyAnywhere: false, pace: 5.0, stamina: 4.0, dribbling: 4.5, passing: 4.5, finishing: 3.5, defending: 5.0, gameIQ: 4.5, gkRating: 4.5 },
  { name: 'Vedu', primaryPosition: 'GK', secondaryPosition: '', happyAnywhere: false, pace: 3.0, stamina: 3.5, dribbling: 3.0, passing: 5.0, finishing: 3.0, defending: 4.5, gameIQ: 7.0, gkRating: 8.5 },
  { name: 'Mandi', primaryPosition: 'MID', secondaryPosition: 'FWD', happyAnywhere: true, pace: 7.5, stamina: 8.0, dribbling: 8.5, passing: 8.0, finishing: 8.5, defending: 8.5, gameIQ: 8.0, gkRating: 6.5 },
  { name: 'Gaurav', primaryPosition: 'FWD', secondaryPosition: 'MID', happyAnywhere: false, pace: 7.0, stamina: 5.5, dribbling: 8.0, passing: 7.5, finishing: 8.0, defending: 4.0, gameIQ: 7.0, gkRating: 4.0 },
  { name: 'Shivanu', primaryPosition: 'FWD', secondaryPosition: '', happyAnywhere: false, pace: 8.5, stamina: 6.0, dribbling: 4.0, passing: 3.5, finishing: 7.5, defending: 4.5, gameIQ: 4.5, gkRating: 4.0 },
  { name: 'Kashish Rana', primaryPosition: 'FWD', secondaryPosition: '', happyAnywhere: false, pace: 7.5, stamina: 7.0, dribbling: 5.0, passing: 5.0, finishing: 6.5, defending: 5.0, gameIQ: 4.0, gkRating: 6.0 },
  { name: 'Shaambhav Shankar', primaryPosition: 'FWD', secondaryPosition: 'DEF', happyAnywhere: false, pace: 6.5, stamina: 5.0, dribbling: 7.0, passing: 6.5, finishing: 6.5, defending: 6.0, gameIQ: 5.0, gkRating: 5.5 },
  { name: 'Abeeral', primaryPosition: 'FWD', secondaryPosition: 'MID', happyAnywhere: true, pace: 8.0, stamina: 8.5, dribbling: 8.5, passing: 6.5, finishing: 8.5, defending: 7.0, gameIQ: 6.5, gkRating: 4.5 },
  { name: 'Hardik Vij', primaryPosition: 'FWD', secondaryPosition: 'MID', happyAnywhere: false, pace: 6.0, stamina: 7.0, dribbling: 7.5, passing: 6.5, finishing: 7.0, defending: 4.5, gameIQ: 6.5, gkRating: 4.0 },
  { name: 'Akshay Jadli', primaryPosition: 'FWD', secondaryPosition: '', happyAnywhere: false, pace: 8.0, stamina: 7.5, dribbling: 7.0, passing: 6.0, finishing: 8.0, defending: 6.5, gameIQ: 6.5, gkRating: 6.0 },
  { name: 'Pankaj', primaryPosition: 'MID', secondaryPosition: 'FWD', happyAnywhere: false, pace: 4.5, stamina: 5.0, dribbling: 7.0, passing: 5.0, finishing: 6.0, defending: 4.0, gameIQ: 5.0, gkRating: 4.0 },
  { name: 'Arunabh', primaryPosition: 'GK', secondaryPosition: 'DEF', happyAnywhere: false, pace: 6.0, stamina: 4.0, dribbling: 3.5, passing: 4.0, finishing: 4.5, defending: 3.5, gameIQ: 3.5, gkRating: 5.5 },
  { name: 'Karun', primaryPosition: 'MID', secondaryPosition: 'DEF', happyAnywhere: true, pace: 7.0, stamina: 8.0, dribbling: 8.5, passing: 8.5, finishing: 7.0, defending: 8.0, gameIQ: 8.5, gkRating: 4.0 },
  { name: 'Shivam Arora', primaryPosition: 'DEF', secondaryPosition: 'GK', happyAnywhere: false, pace: 3.0, stamina: 5.0, dribbling: 6.0, passing: 6.0, finishing: 6.0, defending: 5.5, gameIQ: 6.5, gkRating: 8.0 },
  { name: 'Kartik Srivastava', primaryPosition: 'FWD', secondaryPosition: 'DEF', happyAnywhere: true, pace: 5.0, stamina: 6.5, dribbling: 6.5, passing: 8.0, finishing: 7.0, defending: 7.0, gameIQ: 8.5, gkRating: 5.5 },
  { name: 'Abhinav', primaryPosition: 'MID', secondaryPosition: '', happyAnywhere: false, pace: 5.5, stamina: 6.0, dribbling: 6.0, passing: 6.0, finishing: 6.0, defending: 5.0, gameIQ: 6.0, gkRating: 4.0 },
];
