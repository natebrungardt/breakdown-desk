-- Breakdown Desk seed data. Run after schema.sql. Safe to re-run.
-- Warranty math assumes "today" is roughly Oct 2026; in_service_date drives age.

truncate records, actions, decisions, incident_events, incidents,
  loads, warranty_policies, shops, trucks cascade;

-- ───────────── Trucks ─────────────
-- 3847 is the demo hero: young, low miles, under warranty on everything.
-- 4233 / 4311 are out of warranty (high miles / old) for the "not recoverable" path.

insert into trucks (id, unit_number, make, model, year, odometer_miles, in_service_date) values
  ('T3847', '3847', 'Freightliner', 'Cascadia',  2024, 148230, '2024-03-11'),
  ('T3902', '3902', 'Kenworth',     'T680',      2023, 241560, '2023-06-05'),
  ('T4015', '4015', 'Peterbilt',    '579',       2022, 388900, '2022-04-18'),
  ('T4120', '4120', 'Volvo',        'VNL 860',   2025,  62410, '2025-02-03'),
  ('T4233', '4233', 'International','LT',        2021, 512700, '2021-08-23'),
  ('T4311', '4311', 'Freightliner', 'Cascadia',  2020, 603400, '2020-05-12'),
  ('T4476', '4476', 'Kenworth',     'T680',      2024, 119880, '2024-09-09'),
  ('T4590', '4590', 'Peterbilt',    '579',       2023, 276340, '2023-01-30'),
  ('T4628', '4628', 'Volvo',        'VNL 760',   2022, 331150, '2022-10-17'),
  ('T4751', '4751', 'Freightliner', 'Cascadia',  2025,  38920, '2025-06-24');

-- ───────────── Shops along I-80 (Omaha ↔ Chicago ↔ Denver) ─────────────

insert into shops (id, name, type, oem_make, city, state, lat, lng, capabilities, in_network, labor_rate) values
  ('S01', 'Missouri Valley Freightliner',  'oem_dealer',  'Freightliner',  'Omaha',        'NE', 41.2565, -95.9345, '{engine,aftertreatment,drivetrain,brakes,towing}', true,  165.00),
  ('S02', 'Capital City Kenworth',         'oem_dealer',  'Kenworth',      'Lincoln',      'NE', 40.8136, -96.7026, '{engine,aftertreatment,drivetrain,brakes,towing}', true,  158.00),
  ('S03', 'Cornhusker Diesel Repair',      'independent', null,            'Lincoln',      'NE', 40.7800, -96.6400, '{engine,brakes,drivetrain}',                       false, 112.00),
  ('S04', 'Platte Valley Truck Service',   'independent', null,            'Grand Island', 'NE', 40.9264, -98.3420, '{engine,aftertreatment,brakes,towing}',            true,  118.00),
  ('S05', 'Kearney Tire & Wheel',          'tire',        null,            'Kearney',      'NE', 40.6995, -99.0817, '{tires,towing}',                                   true,   95.00),
  ('S06', 'High Plains Volvo Trucks',      'oem_dealer',  'Volvo',         'North Platte', 'NE', 41.1403, -100.7601,'{engine,aftertreatment,drivetrain,brakes,towing}', true,  162.00),
  ('S07', 'Union Pacific Diesel Works',    'independent', null,            'North Platte', 'NE', 41.1250, -100.7900,'{engine,aftertreatment,brakes}',                   false, 108.00),
  ('S08', 'Sandhills Tire Center',         'tire',        null,            'Ogallala',     'NE', 41.1280, -101.7196,'{tires}',                                          false,  90.00),
  ('S09', 'Panhandle Truck Repair',        'independent', null,            'Sidney',       'NE', 41.1428, -102.9779,'{engine,drivetrain,brakes,towing}',                true,  115.00),
  ('S10', 'Frontier Diesel & Trailer',     'independent', null,            'Cheyenne',     'WY', 41.1400, -104.8202,'{engine,aftertreatment,drivetrain,brakes,towing}', true,  122.00),
  ('S11', 'Rocky Mountain Freightliner',   'oem_dealer',  'Freightliner',  'Denver',       'CO', 39.7817, -104.9290,'{engine,aftertreatment,drivetrain,brakes,towing}', true,  172.00),
  ('S12', 'Mile High Peterbilt',           'oem_dealer',  'Peterbilt',     'Denver',       'CO', 39.8100, -104.9000,'{engine,aftertreatment,drivetrain,brakes,towing}', true,  170.00),
  ('S13', 'Capitol Peterbilt & International','oem_dealer','International','Des Moines',   'IA', 41.6005, -93.6091, '{engine,aftertreatment,drivetrain,brakes,towing}', true,  160.00),
  ('S14', 'Quad Cities Tire & Brake',      'tire',        null,            'Davenport',    'IA', 41.5236, -90.5776, '{tires,brakes,towing}',                            true,   98.00),
  ('S15', 'Heartland Diesel Joliet',       'independent', null,            'Joliet',       'IL', 41.5250, -88.0817, '{engine,aftertreatment,drivetrain,brakes,towing}', true,  125.00);

-- ───────────── Warranty policies (by component) ─────────────

insert into warranty_policies (id, component, max_miles, max_months) values
  ('W01', 'engine',         500000, 60),
  ('W02', 'aftertreatment', 300000, 36),
  ('W03', 'drivetrain',     350000, 48),
  ('W04', 'tires',          100000, 12);

-- ───────────── Current load per truck ─────────────

insert into loads (id, truck_id, customer, origin, destination, delivery_deadline) values
  ('L9001', 'T3847', 'Midwest Grocers Co-op',  'Omaha, NE',        'Denver, CO',       now() + interval '9 hours'),
  ('L9002', 'T3902', 'Prairie Packaging',      'Des Moines, IA',   'Cheyenne, WY',     now() + interval '14 hours'),
  ('L9003', 'T4015', 'Lakeshore Building Supply','Chicago, IL',    'Lincoln, NE',      now() + interval '11 hours'),
  ('L9004', 'T4120', 'Great Plains Beverage',  'Kearney, NE',      'Chicago, IL',      now() + interval '20 hours'),
  ('L9005', 'T4233', 'Rocky Mtn Auto Parts',   'Denver, CO',       'Omaha, NE',        now() + interval '16 hours'),
  ('L9006', 'T4311', 'Cornfield Foods',        'Grand Island, NE', 'Davenport, IA',    now() + interval '18 hours'),
  ('L9007', 'T4476', 'Northern Tool & Supply', 'Joliet, IL',       'Sidney, NE',       now() + interval '26 hours'),
  ('L9008', 'T4590', 'Summit Appliance',       'Denver, CO',       'Des Moines, IA',   now() + interval '22 hours'),
  ('L9009', 'T4628', 'Heartland Paper',        'Omaha, NE',        'Chicago, IL',      now() + interval '13 hours'),
  ('L9010', 'T4751', 'Front Range Produce',    'North Platte, NE', 'Denver, CO',       now() + interval '8 hours');
