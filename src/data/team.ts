import chiefEditor from '../assets/photos/team-chief-editor.png';
import editor from '../assets/photos/team-editor.png';
import writer from '../assets/photos/team-writer.png';
import projectManager from '../assets/photos/team-project-manager.png';
import analyst from '../assets/photos/team-analyst.png';
import seoSpecialist from '../assets/photos/team-seo-specialist.png';
import designer from '../assets/photos/team-designer.png';
import { home } from './home';

// Portraits and role order from Figma 740:12080.
const portraits = [chiefEditor, editor, writer, projectManager, analyst, seoSpecialist, designer];
export const team = {
  title: home.teamTitle,
  intro: home.teamIntro,
  items: home.team.map((member, index) => ({ ...member, image: portraits[index] })),
};
