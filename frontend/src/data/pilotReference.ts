import type { ReferenceOccupation, ReferenceTask } from "@/types/reference";

export const PILOT_OCCUPATIONS: ReferenceOccupation[] = [
  {
    occupation_code: "5",
    level: "major",
    parent_code: null,
    title: "Service and Sales Workers",
    description: null,
  },
  {
    occupation_code: "52",
    level: "sub_major",
    parent_code: "5",
    title: "Sales Workers",
    description: null,
  },
  {
    occupation_code: "522",
    level: "minor",
    parent_code: "52",
    title: "Shop Salespersons",
    description: null,
  },
  {
    occupation_code: "5221",
    level: "unit",
    parent_code: "522",
    title: "Shopkeepers",
    description:
      "Shopkeepers operate small retail shops either independently or with support from a small number of others.",
  },
  {
    occupation_code: "5222",
    level: "unit",
    parent_code: "522",
    title: "Shop Supervisors",
    description:
      "Shop Supervisors supervise and coordinate the activities of shop sales assistants and other workers in retail and wholesale shops such as supermarkets and department stores.",
  },
  {
    occupation_code: "5223",
    level: "unit",
    parent_code: "522",
    title: "Shop Sales Assistants",
    description:
      "Shop Sales Assistants sell a range of goods and services directly to the public or on behalf of retail and wholesale establishments. They explain the functions and qualities of these goods or services.",
  },
];

export const PILOT_TASKS: ReferenceTask[] = [
  { isco_08: "5221", task_id: "1", task_text: "Determining product mix, stock and price levels for goods to be sold;", score_2025: 0.45, potential25: "Exposed: Gradient 2", mean_score_2025: 0.43 },
  { isco_08: "5221", task_id: "2", task_text: "Purchasing and ordering goods for sale from markets, wholesalers and other suppliers;", score_2025: 0.49, potential25: "Exposed: Gradient 2", mean_score_2025: 0.43 },
  { isco_08: "5221", task_id: "3", task_text: "Budgeting and maintaining records of stock levels and financial transactions;", score_2025: 0.59, potential25: "Exposed: Gradient 2", mean_score_2025: 0.43 },
  { isco_08: "5221", task_id: "4", task_text: "Determining prices and displaying goods for sale;", score_2025: 0.39, potential25: "Exposed: Gradient 2", mean_score_2025: 0.43 },
  { isco_08: "5221", task_id: "5", task_text: "Selling goods to customers and advising them on product use;", score_2025: 0.4525, potential25: "Exposed: Gradient 2", mean_score_2025: 0.43 },
  { isco_08: "5221", task_id: "6", task_text: "Examining returned goods and deciding on appropriate action;", score_2025: 0.29, potential25: "Exposed: Gradient 2", mean_score_2025: 0.43 },
  { isco_08: "5221", task_id: "7", task_text: "Taking inventory of goods in stock.", score_2025: 0.3525, potential25: "Exposed: Gradient 2", mean_score_2025: 0.43 },
  { isco_08: "5222", task_id: "1", task_text: "Planning and preparing work schedules and assigning staff to specific duties;", score_2025: 0.525, potential25: "Minimal Exposure", mean_score_2025: 0.36 },
  { isco_08: "5222", task_id: "2", task_text: "Instructing staff on sales procedures, including how to handle difficult or complex cases;", score_2025: 0.365, potential25: "Minimal Exposure", mean_score_2025: 0.36 },
  { isco_08: "5222", task_id: "3", task_text: "Ensuring that customers receive prompt service;", score_2025: 0.515, potential25: "Minimal Exposure", mean_score_2025: 0.36 },
  { isco_08: "5222", task_id: "4", task_text: "Participating in and providing advice to managers on interviewing, hiring, training, evaluating, promoting and dismissing staff, and resolving staff grievances;", score_2025: 0.3075, potential25: "Minimal Exposure", mean_score_2025: 0.36 },
  { isco_08: "5222", task_id: "5", task_text: "Examining returned goods and deciding on appropriate action;", score_2025: 0.27, potential25: "Minimal Exposure", mean_score_2025: 0.36 },
  { isco_08: "5222", task_id: "6", task_text: "Taking inventory of goods for sale and ordering new stock;", score_2025: 0.33, potential25: "Minimal Exposure", mean_score_2025: 0.36 },
  { isco_08: "5222", task_id: "7", task_text: "Ensuring that goods and services are correctly priced and displayed;", score_2025: 0.4125, potential25: "Minimal Exposure", mean_score_2025: 0.36 },
  { isco_08: "5222", task_id: "8", task_text: "Ensuring that safety procedures are enforced.", score_2025: 0.1575, potential25: "Minimal Exposure", mean_score_2025: 0.36 },
  { isco_08: "5223", task_id: "1", task_text: "Determining customer requirements and advising on product range, price, delivery, warranties and product use and care;", score_2025: 0.47, potential25: "Exposed: Gradient 1", mean_score_2025: 0.38 },
  { isco_08: "5223", task_id: "2", task_text: "Demonstrating and explaining to customers the establishment's goods and services;", score_2025: 0.45, potential25: "Exposed: Gradient 1", mean_score_2025: 0.38 },
  { isco_08: "5223", task_id: "3", task_text: "Selling goods and services, accepting payment by a variety of payment methods, preparing sales invoices and recording sales using cash registers;", score_2025: 0.55, potential25: "Exposed: Gradient 1", mean_score_2025: 0.38 },
  { isco_08: "5223", task_id: "4", task_text: "Assisting with the ongoing management of stock such as product inventories and participating in stock takes;", score_2025: 0.295, potential25: "Exposed: Gradient 1", mean_score_2025: 0.38 },
  { isco_08: "5223", task_id: "5", task_text: "Stacking and displaying goods for sale, and wrapping and packing goods sold.", score_2025: 0.1575, potential25: "Exposed: Gradient 1", mean_score_2025: 0.38 },
];

export const listPilotOccupations = (parent?: string) => {
  if (parent) {
    return PILOT_OCCUPATIONS.filter((item) => item.parent_code === parent);
  }
  return PILOT_OCCUPATIONS.filter((item) => item.level === "major");
};

export const searchPilotOccupations = (query: string) => {
  const needle = query.trim().toLowerCase();
  return PILOT_OCCUPATIONS.filter(
    (item) =>
      item.level === "unit" &&
      (item.title.toLowerCase().includes(needle) ||
        (item.description ?? "").toLowerCase().includes(needle)),
  );
};

export const getPilotOccupation = (code: string) =>
  PILOT_OCCUPATIONS.find((item) => item.occupation_code === code) ?? null;

export const listPilotTasks = (occupationCode: string) =>
  PILOT_TASKS.filter((task) => task.isco_08 === occupationCode);
