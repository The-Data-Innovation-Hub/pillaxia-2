-- Seed medication_catalog with common medications used in Nigeria
-- Only inserts if the table is empty to avoid duplicates on re-run.

INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form, manufacturer)
SELECT * FROM (VALUES
  -- Analgesics / Antipyretics
  ('Paracetamol', 'Acetaminophen', '500', 'mg', 'tablet', 'Emzor'),
  ('Paracetamol', 'Acetaminophen', '120', 'mg/5ml', 'syrup', 'Emzor'),
  ('Ibuprofen', 'Ibuprofen', '400', 'mg', 'tablet', NULL),
  ('Ibuprofen', 'Ibuprofen', '200', 'mg', 'tablet', NULL),
  ('Diclofenac', 'Diclofenac Sodium', '50', 'mg', 'tablet', NULL),
  ('Tramadol', 'Tramadol HCl', '50', 'mg', 'capsule', NULL),

  -- Antibiotics
  ('Amoxicillin', 'Amoxicillin', '500', 'mg', 'capsule', NULL),
  ('Amoxicillin', 'Amoxicillin', '250', 'mg/5ml', 'syrup', NULL),
  ('Augmentin', 'Amoxicillin/Clavulanate', '625', 'mg', 'tablet', 'GSK'),
  ('Ciprofloxacin', 'Ciprofloxacin', '500', 'mg', 'tablet', NULL),
  ('Metronidazole', 'Metronidazole', '400', 'mg', 'tablet', NULL),
  ('Azithromycin', 'Azithromycin', '500', 'mg', 'tablet', NULL),
  ('Ceftriaxone', 'Ceftriaxone', '1', 'g', 'injection', NULL),
  ('Erythromycin', 'Erythromycin', '500', 'mg', 'tablet', NULL),

  -- Antimalarials
  ('Artemether-Lumefantrine', 'Artemether/Lumefantrine', '20/120', 'mg', 'tablet', NULL),
  ('Artesunate', 'Artesunate', '60', 'mg', 'injection', NULL),
  ('Chloroquine', 'Chloroquine Phosphate', '250', 'mg', 'tablet', NULL),

  -- Antihypertensives
  ('Amlodipine', 'Amlodipine', '5', 'mg', 'tablet', NULL),
  ('Amlodipine', 'Amlodipine', '10', 'mg', 'tablet', NULL),
  ('Lisinopril', 'Lisinopril', '10', 'mg', 'tablet', NULL),
  ('Losartan', 'Losartan', '50', 'mg', 'tablet', NULL),
  ('Nifedipine', 'Nifedipine', '20', 'mg', 'tablet', NULL),
  ('Atenolol', 'Atenolol', '50', 'mg', 'tablet', NULL),
  ('Hydrochlorothiazide', 'Hydrochlorothiazide', '25', 'mg', 'tablet', NULL),

  -- Diabetes
  ('Metformin', 'Metformin HCl', '500', 'mg', 'tablet', NULL),
  ('Metformin', 'Metformin HCl', '850', 'mg', 'tablet', NULL),
  ('Glimepiride', 'Glimepiride', '2', 'mg', 'tablet', NULL),
  ('Insulin Glargine', 'Insulin Glargine', '100', 'IU/ml', 'injection', 'Sanofi'),
  ('Insulin Regular', 'Human Insulin', '100', 'IU/ml', 'injection', NULL),

  -- Gastrointestinal
  ('Omeprazole', 'Omeprazole', '20', 'mg', 'capsule', NULL),
  ('Loperamide', 'Loperamide', '2', 'mg', 'capsule', NULL),
  ('Oral Rehydration Salts', 'ORS', '1', 'sachet', 'powder', 'WHO'),
  ('Ranitidine', 'Ranitidine', '150', 'mg', 'tablet', NULL),

  -- Respiratory
  ('Salbutamol', 'Albuterol', '100', 'mcg', 'inhaler', NULL),
  ('Prednisolone', 'Prednisolone', '5', 'mg', 'tablet', NULL),
  ('Cetirizine', 'Cetirizine', '10', 'mg', 'tablet', NULL),
  ('Loratadine', 'Loratadine', '10', 'mg', 'tablet', NULL),

  -- Vitamins & Supplements
  ('Folic Acid', 'Folic Acid', '5', 'mg', 'tablet', NULL),
  ('Ferrous Sulphate', 'Iron', '200', 'mg', 'tablet', NULL),
  ('Vitamin C', 'Ascorbic Acid', '100', 'mg', 'tablet', NULL),
  ('Multivitamin', 'Multivitamin', '1', 'tablet', 'tablet', NULL),
  ('Vitamin B Complex', 'B Vitamins', '1', 'tablet', 'tablet', NULL),

  -- Antiretrovirals (common first-line)
  ('TLD', 'Tenofovir/Lamivudine/Dolutegravir', '300/300/50', 'mg', 'tablet', NULL),

  -- Controlled Substances (commonly dispensed)
  ('Codeine Phosphate', 'Codeine', '30', 'mg', 'tablet', NULL),
  ('Morphine Sulphate', 'Morphine', '10', 'mg', 'tablet', NULL),
  ('Diazepam', 'Diazepam', '5', 'mg', 'tablet', NULL),
  ('Phenobarbital', 'Phenobarbital', '30', 'mg', 'tablet', NULL)

) AS v(name, generic_name, dosage, dosage_unit, form, manufacturer)
WHERE NOT EXISTS (SELECT 1 FROM public.medication_catalog LIMIT 1)
ON CONFLICT (name, dosage, dosage_unit, form) DO NOTHING;
