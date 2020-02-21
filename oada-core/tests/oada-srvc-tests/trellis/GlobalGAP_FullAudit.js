module.exports = {
  _type: 'application/vnd.trellisfw.audit.globalgap.1+json',

  // certificationid identifies a particular chain of documents that culinates
  // in a certification if successful.  All documents in the chain (audit, corrective
  // actions, certificate) will have the same certificationid.
  certificationid: {
    id_source: 'scheme', // source for this ID is the scheme owner described elsewhere
    id: '12345-AAAAA-6789' // in this audit (global gap in this case)
  },

  // scheme: info about the type of audit
  scheme: {
    name: 'GLOBALG.A.P.', // Does GFSI maintain a list of strings which would be valid here?
    version: '5.0-1',
    option: '1',
    modules: [
      { name: 'All Farm Base' },
      { name: 'Crops Base' },
      { name: 'Fruit and Vegetables' }
    ]
  },

  // certifying body: info about who performed the audit
  certifying_body: {
    name: 'SCS Global Services',
    auditor: { name: 'Aaron Auditor Ault' }
  },

  // Organization contains information about the party being audited.
  organization: {
    organizationid: {
      id_source: 'scheme', // the certifying body already described in this document
      id: '777777777', // This is the GLOBALG.A.P Number for this organization
      otherids: [{ id_source: 'certifying_body', id: '1234567' }]
    },
    name: 'Noel Produce Masters',
    contacts: [{ name: 'Sam Noel' }],
    location: {
      description: '(All sites in same area), Pesticide storage',
      street_address: '44641 SW Plumlee Rd.',
      city: 'Nowhere',
      state: 'Florida',
      country: 'USA'
    }
  },

  // Scope: what sorts of things does this audit cover (operation, products, etc.)
  scope: {
    notification: 'announced', //or 'unannounced'
    description: '',
    operations: [
      { name: 'handling' } // if handling is "no", then don't include it in the array
    ],

    // Called "Crops audited" in global gap, but same as "products_observed" in primus
    // At this level, it should refer to all crops that have any operation audited.
    // Then if any one of the operations only has a subset of the total crops
    // (for example, if harvest is only audited for one crop and not the others),
    // then the particular operation above will have the same "products_observed" key,
    // but it will only have the names of the products that have harvest included.
    //
    products_observed: [
      {
        name: 'Blueberries',
        first_area: { value: 70, units: 'acres' },
        further_area: { value: 10.67, units: 'acres' },
        operations: [
          { name: 'growing', covering_type: 'uncovered' },
          { name: 'harvest' } // if harvest is excluded, then don't include it in the array
        ]
      }
    ],

    similar_products_not_observed: [
      {
        name: 'Snozzberries'
      }
    ],

    production_sites: [
      {
        name: 'The Big Ranch',
        id: '1234',
        products_observed: [
          {
            name: 'Blueberries',
            organic: true,
            area: { value: 70, units: 'acres' },
            location: {
              description: '', //any accompanying text description; often used to supply directions
              city: ''
            }
          }
        ]
      }
    ],

    parallel_production: false, // optional, true/false
    parallel_ownership: false // optional, true/false
  },

  conditions_during_audit: {
    // what should we call it if there is just a single "audit date"?
    operation_observed_date: '2016-07-26',
    duration: { value: 4.5, units: 'hours' }
  },

  score: {
    is_compliant: false, // because in this example, major_musts.is_compliant is false
    // If there is a total score, you can put value and units under score directly.
    // If there is a preliminary/final score, put them under preliminary/final
    globalgap_levels: {
      major_musts: {
        yes: { value: '12', units: 'count' },
        no: { value: '1', units: 'count' },
        n_a: { value: '32', units: 'count' },
        is_compliant: false
      },
      minor_musts: {
        yes: { value: '12', units: 'count' },
        no: { value: '1', units: 'count' },
        n_a: { value: '32', units: 'count' },
        value: '98.72',
        units: '%',
        is_compliant: true
      }
    }
  },

  //A summary of failed questions and corrective actions are reported on the last page.

  sections: [
    {
      sectionid: 'AF',
      name: 'All Farm Base',
      sections: [
        {
          sectionid: 'AF 1',
          name: 'Site History and Site Management',
          sections: [
            {
              sectionid: 'AF 1.1',
              name: 'Site History',
              control_pointids: ['AF 1.1.1', 'AF 1.1.2']
            },
            {
              sectionid: 'AF 1.2',
              name: 'Site Management',
              control_pointids: ['AF 1.2.1', 'AF 1.2.2']
            }
          ]
        },
        {
          // !!! Note the variable section depth.
          sectionid: 'AF 2',
          name:
            'Record Keeping And Internal Self-Assessment/Internal Inspection',
          control_pointids: ['AF 2.1', 'AF 2.2', 'AF 2.3']
        },
        {
          sectionid: 'AF 3',
          name: 'Hygine',
          control_pointids: ['AF 3.1', 'AF 3.2', 'AF 3.3', 'AF 3.4']
        },
        {
          sectionid: 'AF 4',
          name: "Workers' Health, Safety, and Wellfare",
          sections: [
            {
              sectionid: 'AF 4.1',
              name: 'Health and Safety',
              control_pointids: ['AF 4.1.1', 'AF 4.1.2', 'AF 4.1.3']
            },
            {
              sectionid: 'AF 4.2',
              name: 'Training',
              control_pointids: ['AF 4.2.1', 'AF 4.2.2']
            },
            {
              sectionid: 'AF 4.3',
              name: 'Hazards and First Aid',
              control_pointids: [
                'AF 4.3.1',
                'AF 4.3.2',
                'AF 4.3.3',
                'AF 4.3.4',
                'AF 4.3.5'
              ]
            },
            {
              sectionid: 'AF 4.4',
              name: 'Protective Clothing/Equipment',
              control_pointids: ['AF 4.4.1', 'AF 4.4.2']
            },
            {
              sectionid: 'AF 4.5',
              name: 'Worker Welfare',
              control_pointids: [
                'AF 4.5.1',
                'AF 4.5.2',
                'AF 4.5.3',
                'AF 4.5.4',
                'AF 4.5.5'
              ]
            }
          ]
        },
        {
          sectionid: 'AF 5',
          name: 'Subcontractors',
          control_pointids: ['AF 5.1']
        },
        {
          sectionid: 'AF 6',
          name: 'Waste and Polution Management, Recycling and Re-use',
          sections: [
            {
              scetionid: 'AF 6.1',
              name: 'Identification of Waste and Pollutants',
              control_pointids: ['AF 6.1.1']
            },
            {
              sectionid: 'AF 6.2',
              name: 'Waste and Pollution Action Plan',
              control_pointids: [
                'AF 6.2.1',
                'AF 6.2.2',
                'AF 6.2.3',
                'AF 6.2.4',
                'AF 6.2.5'
              ]
            }
          ]
        },
        {
          sectionid: 'AF 7',
          name: 'Conservation',
          sections: [
            {
              sectionid: 'AF 7.1',
              name:
                'Impact of Farming on the Environment and Biodiversity (Cross-reference with AB.9 Aquaculture Module)',
              control_pointids: ['AF 7.1.1', 'AF 7.1.2']
            },
            {
              sectionid: 'AF 7.2',
              name: 'Ecological Upgrading of Unproductive Sites',
              control_pointids: ['AF 7.2.1']
            },
            {
              sectionid: 'AF 7.3',
              name: 'Energy Efficiency',
              control_pointids: ['AF 7.3.1', 'AF 7.3.2', 'AF 3.3.3']
            },
            {
              sectionid: 'AF 7.4',
              name: 'Water Collection/Recycling',
              sections: ['AF 7.4.1']
            }
          ]
        },
        {
          sectionid: 'AF 8',
          name: 'Complaints',
          control_pointids: ['AF 8.1']
        },
        {
          sectionid: 'AF 9',
          name: 'Recall/Withdrawal Procedure',
          control_pointids: ['AF 9.1']
        },
        {
          sectionid: 'AF 10',
          name: 'Food Defence (not applicable for Flowers and Ornamentals)',
          control_pointids: ['AF 10.1']
        },
        {
          sectionid: 'AF 11',
          name: 'Global G.A.P Status',
          control_pointids: ['AF 11.1']
        },
        {
          sectionid: 'AF 12',
          name: 'Logo Use',
          control_pointids: ['AF 12.1']
        },
        {
          sectionid: 'AF 13',
          name: 'Traceability and Segregation',
          control_pointids: ['AF 13.1', 'AF 13.2', 'AF 13.3', 'AF 13.4']
        },
        {
          sectionid: 'AF 14',
          name: 'Mass Balance',
          control_pointids: ['AF 14.1', 'AF 14.2', 'AF 14.3']
        },
        {
          sectionid: 'AF 15',
          name: 'Food Safety Policy Declaration',
          control_pointids: ['AF 15.1']
        },
        {
          sectionid: 'AF 16',
          name: 'Food Fraud Mitigation',
          control_pointids: ['AF 16.1', 'AF 16.2']
        },
        {
          sectionid: 'CB',
          name: 'Crops Base',
          sections: [
            {
              sectionid: 'CB 1',
              name: 'Traceability',
              control_pointids: ['CB 1.1']
            },
            {
              sectionid: 'CB 2',
              name: 'Propagation Material',
              sections: [
                {
                  sectionid: 'CB 2.1',
                  name: 'Quality and Health',
                  control_pointids: ['CB 2.1.1', 'CB 2.1.2', 'CB 2.1.3']
                },
                {
                  sectionid: 'CB 2.2',
                  name: 'Chemical Treatments and Dressings',
                  control_pointids: ['CB 2.2.1', 'CB 2.2.2']
                },
                {
                  sectionid: 'CB 2.3',
                  name:
                    'Genetically Modified Organisms (N/A if no genetically modified varieties are used)',
                  control_pointids: [
                    'CB 2.3.1',
                    'CB 2.3.2',
                    'CB 2.3.3',
                    'CB 2.3.4',
                    'CB 2.3.5'
                  ]
                }
              ]
            },
            {
              sectionid: 'CB 3',
              name: 'Soil Management and Conservation',
              control_pointids: [
                'CB 3.1',
                'CB 3.2',
                'CB 3.3',
                'CB 3.4',
                'CB 3.5',
                'CB 3.6',
                'CB 3.7'
              ]
            },
            {
              sectionid: 'CB 4',
              name: 'Fertilizer Application',
              sections: [
                {
                  sectionid: 'CB 4.1',
                  name: 'Advice on Quantity and Type of Fertilizer',
                  control_pointids: ['CB 4.1.1']
                },
                {
                  sectionid: 'CB 4.2',
                  name: 'Records of Application',
                  control_pointids: [
                    'CB 4.2.1',
                    'CB 4.2.2',
                    'CB 4.2.3',
                    'CB 4.2.4',
                    'CB 4.2.5',
                    'CB 4.2.6'
                  ]
                },
                {
                  sectionid: 'CB 4.3',
                  name: 'Fertilizer Storage',
                  control_pointids: [
                    'CB 4.3.1',
                    'CB 4.3.2',
                    'CB 4.3.3',
                    'CB 4.3.4',
                    'CB 4.3.5',
                    'CB 4.3.6',
                    'CB 4.3.7'
                  ]
                },
                {
                  sectionid: 'CB 4.4',
                  name: 'Organic Fertilizer',
                  control_pointids: ['CB 4.1.1', 'CB 4.4.2', 'CB 4.4.3']
                },
                {
                  sectionid: 'CB 4.5',
                  name: 'Nutrient Content of Inorganic Fertilizers',
                  control_pointids: ['CB 4.5.1', 'CB 4.5.2']
                }
              ]
            },
            {
              sectionid: 'CB 5',
              name: 'Water Management',
              sections: [
                {
                  sectionid: 'CB 5.1',
                  name: 'Predicting Irrigation Requirements',
                  control_pointids: ['CB 5.1.1']
                },
                {
                  sectionid: 'CB 5.2',
                  name: 'Irrigation/Fertigation Management',
                  control_pointids: ['CB 5.2.1', 'CB 5.2.2', 'CB 5.2.3']
                },
                {
                  sectionid: 'CB 5.3',
                  name: 'Water Quality',
                  control_pointids: [
                    'CB 5.3.1',
                    'CB 5.3.2',
                    'CB 5.3.3',
                    'CB 5.3.4',
                    'CB 5.3.5'
                  ]
                },
                {
                  sectionid: 'CB 5.4',
                  name: 'Supply of Irrigation/Fertigation Water',
                  control_pointids: ['CB 5.4.1', 'CB 5.4.2']
                },
                {
                  sectionid: 'CB 5.5',
                  name: 'Water Storage Facilities',
                  control_pointids: ['CB 5.5.1']
                }
              ]
            },
            {
              sectionid: 'CB 6',
              name: 'Integrated Pest Management',
              control_pointids: [
                'CB 6.1',
                'CB 6.2',
                'CB 6.3',
                'CB 6.4',
                'CB 6.5'
              ]
            },
            {
              sectionid: 'CB 7',
              name: 'Plant Protection Products',
              sections: [
                {
                  sectionid: 'CB 7.1',
                  name: 'Choice of Plant Protection Products',
                  control_pointids: [
                    'CB 7.1.1',
                    'CB 7.1.2',
                    'CB 7.1.3',
                    'CB 7.1.4'
                  ]
                },
                {
                  sectionid: 'CB 7.2',
                  name:
                    'Advice on Quantity and Type of Plant Protection Products',
                  control_pointids: ['CB 7.2.1']
                },
                {
                  sectionid: 'CB 7.3',
                  name: 'Records of Application',
                  control_pointids: [
                    'CB 7.3.1',
                    'CB 7.3.2',
                    'CB 7.3.3',
                    'CB 7.3.4',
                    'CB 7.3.5',
                    'CB 7.3.6',
                    'CB 7.3.7',
                    'CB 7.3.8',
                    'CB 7.3.9'
                  ]
                },
                {
                  sectionid: 'CB 7.4',
                  name:
                    'Pre-Harvest Interval (Not Applicable for Flowers and Ornamentals)',
                  control_pointids: ['CB 7.4.1']
                },
                {
                  sectionid: 'CB 7.5',
                  name: 'Disposal of Surplus Application Mix',
                  control_pointids: ['CB 7.5.1']
                },
                {
                  sectionid: 'CB 7.6',
                  name:
                    'Plant Protection Product Residue Analysis (N/A for Flowers and Ornamental Production)',
                  control_pointids: [
                    'CB 7.6.1',
                    'CB 7.6.2',
                    'CB 7.6.3',
                    'CB 7.6.4',
                    'CB 7.6.5',
                    'CB 7.6.6',
                    'CB 7.6.7'
                  ]
                },
                {
                  sectionid: 'CB 7.7',
                  name: 'Plant Protection Product Storage',
                  control_pointids: [
                    'CB 7.7.1',
                    'CB 7.7.2',
                    'CB 7.7.3',
                    'CB 7.7.4',
                    'CB 7.7.5',
                    'CB 7.7.6',
                    'CB 7.7.7',
                    'CB 7.7.8',
                    'CB 7.7.9',
                    'CB 7.7.10',
                    'CB 7.7.11',
                    'CB 7.7.12',
                    'CB 7.7.13',
                    'CB 7.7.14',
                    'CB 7.7.15'
                  ]
                },
                {
                  sectionid: 'CB 7.8',
                  name:
                    'Plant Protection Product Handling (N/A if no Plant Protection Product Handling)',
                  control_pointids: [
                    'CB 7.8.1',
                    'CB 7.8.2',
                    'CB 7.8.3',
                    'CB 7.8.4'
                  ]
                },
                {
                  sectionid: 'CB 7.9',
                  name: 'Empty Plant Protection Product Containers',
                  control_pointids: [
                    'CB 7.9.1',
                    'CB 7.9.2',
                    'CB 7.9.3',
                    'CB 7.9.4',
                    'CB 7.9.5',
                    'CB 7.9.6'
                  ]
                },
                {
                  sectionid: 'CB 7.10',
                  name: 'Obsolete Plant Protection Products',
                  control_pointids: ['CB 7.10.1']
                },
                {
                  sectionid: 'CB 7.11',
                  name:
                    'Application of Substances other than Fertilizer and Plant Protection Products',
                  control_pointids: ['CB 7.11.1']
                }
              ]
            },
            {
              sectionid: 'CB 8',
              name: 'Equipment',
              control_pointids: ['CB 8.1', 'CB 8.2', 'CB 8.3', 'CB 8.4']
            }
          ]
        },
        {
          sectionid: 'FV',
          name: 'Fruits and Vegetables',
          sections: [
            {
              sectionid: 'FV 1',
              name: 'Site Management',
              sections: [
                {
                  sectionid: 'FV 1.1',
                  name: 'Risk Assessment',
                  control_pointids: ['FV 1.1.1', 'FV 1.1.2']
                }
              ]
            },
            {
              sectionid: 'FV 2',
              name: 'Soil Management',
              sections: [
                {
                  sectionid: 'FV 2.1',
                  name: 'Soil Fumigation (N/A if no soil fumigation)',
                  control_pointids: ['FV 2.1.1', 'FV 2.2.2']
                }
              ]
            },
            {
              sectionid: 'FV 3',
              name: 'Substrates (N/A if substrates not used',
              control_pointids: ['FV 3.1', 'FV 3.2', 'FV 3.3']
            },
            {
              sectionid: 'FV 4',
              name:
                'Pre-Harvest (Refer to Annex FV 1 GLOBALG.A.P. Guideline - Microbiological Hazards)',
              sections: [
                {
                  sectionid: 'FV 4.1',
                  name:
                    'Quality of Water Used on Pre-Harvest Activities (in crops that are continuously harvested)',
                  control_pointids: [
                    'FV 4.1.1',
                    'FV 4.1.2',
                    'FV 4.1.3',
                    'FV 4.1.4'
                  ]
                },
                {
                  sectionid: 'FV 4.2',
                  name: 'Application of Organic Fertilizer of Animal Origin',
                  control_pointids: ['FV 4.2.1']
                },
                {
                  sectionid: 'FV 4.3',
                  name: 'Pre-Harvest Check',
                  control_pointids: ['FV 4.3.1']
                }
              ]
            },
            {
              sectionid: 'FV 5',
              name: 'HARVEST AND POST-HARVEST (PRODUCT HANDLING) ACTIVITIES',
              sections: [
                {
                  sectionid: 'FV 5.1',
                  name:
                    'Principles of Hygiene (Refer to Annex FV 1 GLOBALG.A.P. Guideline - Microbiological Hazards)',
                  control_pointids: [
                    'FV 5.1.1',
                    'FV 5.1.2',
                    'FV 5.1.3',
                    'FV 5.1.4',
                    'FV 5.1.5',
                    'FV 5.1.6'
                  ]
                },
                {
                  sectionid: 'FV 5.2',
                  name: 'Sanitary Facilities',
                  control_pointids: [
                    'FV 5.2.1',
                    'FV 5.2.2',
                    'FV 5.2.3',
                    'FV 5.2.4',
                    'FV 5.2.5',
                    'FV 5.2.6'
                  ]
                },
                {
                  sectionid: 'FV 5.3',
                  name: 'Water Quality',
                  control_pointids: ['FV 5.3.1']
                },
                {
                  sectionid: 'FV 5.4',
                  name:
                    'Packing and Storage Areas (N/A when there is no product packing and/or storing)',
                  control_pointids: [
                    'FV 5.4.1',
                    'FV 5.4.2',
                    'FV 5.4.3',
                    'FV 5.4.4',
                    'FV 5.4.5',
                    'FV 5.4.6',
                    'FV 5.4.7',
                    'FV 5.4.8',
                    'FV 5.4.9',
                    'FV 5.4.10'
                  ]
                },
                {
                  sectionid: 'FV 5.5',
                  name: 'Temperature and Humidity Control',
                  control_pointids: ['FV 5.5.1']
                },
                {
                  sectionid: 'FV 5.6',
                  name: 'Past Control',
                  control_pointids: ['FV 5.6.1', 'FV 5.6.2', 'FV 5.6.3']
                },
                {
                  sectionid: 'FV 5.7',
                  name:
                    'Post-Harvest Washing (N/A when no post-harvest washing)',
                  control_pointids: ['FV 5.7.1', 'FV 5.7.2', 'FV 5.7.3']
                },
                {
                  sectionid: 'FV 5.8',
                  name:
                    'Post-Harvest Treatments (N/A when no post-harvest treatments)',
                  control_pointids: [
                    'FV 5.8.1',
                    'FV 5.8.2',
                    'FV 5.8.3',
                    'FV 5.8.4',
                    'FV 5.8.5',
                    'FV 5.8.6',
                    'FV 5.8.7',
                    'FV 5.8.8',
                    'FV 5.8.9',
                    'FV 5.8.10'
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  control_points: {
    'AF 1.1.1': {
      question_name:
        'Is there a reference system for each field, orchard, greenhouse, yard, plot, livestock building/pen, and/or other area/location used in production?',
      criteria: [
        'A physical sign at each field/orchard, greenhouse/yard/plot/livestock building/pen, or other farm area/location',
        'A farm map, which also identifies the location of water sources, storage/handling facilities, ponds, stables, etc. and that could be cross-referenced to the identification system.'
      ],
      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Site map was available for review. Broken down by Field ID. Variety and acreage is listed on legend indicating which applies to each block. Fuel and drip water line indicated on map.'
    },
    'AF 1.1.2': {
      question_name:
        'Is a recording system established for each unit of production or other area/location to provide a record of the livestock/aquaculture production and/or agronomic activities undertaken at those locations?',
      criteria: [
        'Current records shall provide a history of GLOBALG.A.P. production of all production areas. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Use of field ID as recording system.'
    },
    'AF 1.2.1': {
      question_name:
        'Is there a risk assessment available for all sites registered for certification (this includes rented land, structures and equipment) and does this risk assessment show that the site in question is suitable for production, with regards to food safety, the environment, and health and welfare of animals in the scope of the livestock and aquaculture certification where applicable?',
      criteria: [
        'A written risk assessment to determine whether the sites are appropriate for production shall be available for all sites. It shall be ready for the initial inspection and maintained updated and reviewed when new sites enter in production and when risks for existing ones have changed, or at least annually, whichever is shorter. The risk assessment may be based on a generic one but shall be customized to the farm situation.Risk assessments shall take into account:- Potential physical, chemical (including allergens) and biological hazards- Site history (for sites that are new to agricultural production, history of five years is advised and a minimum of one year shall be known)- Impact of proposed enterprises on adjacent stock/crops/ environment, and the health and safety of animals in the scope of the livestock and aquaculture certification.(See AF Annex 1 and AF Annex 2 for guidance on risk assessments. FV Annex 1 includes guidance regarding flooding)'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'New Site Risk Assessment LogCode: PA-FR-13 Reviewed/Updated:The inspection criteria considers adjacent ground, water source, and ground history.Dated 6/23/16. Livestock adjacent to on side of property. New fence built in response.'
    },
    'AF 1.2.2': {
      question_name:
        'Has a management plan that establishes strategies to minimize the risks identified in the risk assessment (AF 1.2.1) been developed and implemented?',
      criteria: [
        'A management plan addresses the risks identified in AF 1.2.1 and describes the hazard control procedures that justify that the site in question is suitable for production. This plan shall be appropriate to the farm operations products being produced, and there shall be evidence of its implementation and effectiveness. NOTE: Environmental risks do not need to be part of this plan and are covered under AF 7.1.1.'
      ],
      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Control Measures are listed with each risk identified in the Site Risk Assessment.'
    },
    'AF 2.1': {
      question_name:
        'Are all records requested during the external inspection accessible and kept for a minimum period of two years, unless a longer requirement is stated in specific control points?',
      criteria: [
        'Producers shall keep up-to-date records for a minimum of two years. Electronic records are valid and when they are used, producers are responsible for maintaining back-ups of the information.For the initial inspections, producers shall keep records from at least three months prior to the date of the external inspection or from the day of registration, whichever is longer. New applicants shall have full records that reference each area covered by the registration with all of the agronomic activities related to GLOBALG.A.P. documentation required for this area. For Livestock, these records shall be available for the current livestock cycle before the initial inspection. This refers to the principle of record keeping. When an individual record is missing, the respective control point dealing with those records is not compliant. No NA.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Records were available.'
    },
    'AF 2.2': {
      question_name:
        'Does the producer take responsibility to conduct a minimum of one internal self-assessment per year against the GLOBALG.A.P. Standard?',
      criteria: [
        'There is documented evidence that in Option 1 an internal self-assessment has been completed under the responsibility of the producer (this may be carried out by a person different from the producer). Self-assessments shall include all applicable control points, even when a subcontracted company carries them out. The self-assessment checklist shall contain comments of the evidence observed for all non-applicable and non-compliant control points.This has to be done before the CB inspection (See General Regulations Part I, 5.).No N/A, except for multi-site operations with QMS and producer groups, for which the QMS checklist covers internal inspections.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Self assessment was completed on 4/28/16 by Patty Laskey. Quarterly Safety Inspection was also completed. Indicates several items on farm that were addressed.'
    },
    'AF 2.3': {
      question_name:
        'Have effective corrective actions been taken as a result of non-conformances detected during the internal self-assessment or internal producer group inspections?',
      criteria: [
        'Necessary corrective actions are documented and have been implemented. N/A only in the case no non-conformances are detected during internal self-assessments or internal producer group inspections.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Corrective Action Log: GI-FR-04Date, NC, and immediate Correction, OR Root Cause, Corrective Action and Follow up Evaluation depending on issue.Completed by: Patty Laskey and Jose Montano. Sl it d dt litd 7/3/16 F bilt'
    },
    'AF 3.1': {
      question_name:
        'Does the farm have a written risk assessment for hygiene?',
      criteria: [
        'The written risk assessment for hygiene issues covers the production environment. The risks depend on the products produced and/or supplied. The risk assessment can be a generic one, but it shall be appropriate for conditions on the farm and shall be reviewed annually and updated when changes (e.g. other activities) occur. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Hygiene Risk Assessment GI-FR-04Reviewed/Updated:Considers specific biological risks as well as more general chemical and physical risks in two sections: Harvest & Field handling, Transportation (From field to Cooler), and Farming activities. Dated 6/16/16.'
    },
    'AF 3.2': {
      question_name:
        'Does the farm have a documented hygiene procedure and visibly displayed hygiene instructions for all workers and visitors to the site whose activities might pose a risk to food safety?',
      criteria: [
        'The farm shall have a hygiene procedure addressing the risks identified in the risk assessment in AF 3.1. The farm shall also have hygiene instructions visibly displayed for workers (including subcontractors) and visitors; provided by way of clear signs (pictures) and/or in the predominant language(s) of the workforce. The instructions must also be based on the results of the hygiene risk assessment in AF 3.1 and include at a minimum- The need to wash hands- The need to cover skin cuts- Limitation on smoking, eating and drinking to designated areas - Notification of any relevant infections or conditions. This includes any signs of illness (e.g. vomiting; jaundice, diarrhea), whereby these workers shall be restricted from direct contact with the product and food-contact surfaces- Notification of product contamination with bodily fluids- The use of suitable protective clothing, where the individuals’ activities might pose a risk of contamination to the product.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Hygiene During the Harvest SOP PA-PO-02Reviewed/Updated:The procedures outlines the Responsibilities, Precautions, and Activities which include: Personal Hygiene and Behavior, Cleaning of the Field, Use of Gloves, Worker Health, Training, Utensils, Handing Packaging, Fruit Transport Conditions and Sanitary Facilities.'
    },
    'AF 3.3': {
      question_name:
        'Have all persons working on the farm received annual hygiene training appropriate to their activities and according to the hygiene instructions in AF 3.2?',
      criteria: [
        'An introductory training course for hygiene shall be given in both written and verbal form. All new workers shall receive this training and confirm their participation. This training shall cover all instructions defined in AF 3.2. All workers, including the owners and managers, shall annually participate in the farm’s basic hygiene training.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Training Log GI-FR-07Example Date:1/5/16Topic: Agriculture Safety Seminars, Given by Oregon Agriculture IndustryParticipants:4 Year round EmployeesInstructor: Kevin White. SAIF Corporation. Farm Labor Contractor Also conducts training on hygiene. AAT Agriculture(FLC)'
    },
    'AF 3.4': {
      question_name: 'Are the farm’s hygiene procedures implemented?',
      criteria: [
        'Workers with tasks identified in the hygiene procedures shall demonstrate competence during the inspection and there is visual evidence that the hygiene procedures are being implemented. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Hygiene procedures were being implemented.'
    },
    'AF 4.1.1': {
      question_name:
        'Does the producer have a written risk assessment for hazards to workers’ health and safety?',
      criteria: [
        'The written risk assessment can be a generic one but it shall be appropriate to conditions on the farm, including the entire production process in the scope of certification. The risk assessment shall be reviewed and updated annually and when changes that could impact workers health and safety (e.g. new machinery, new buildings, new plant protection products, modified cultivation practices, etc.) occur. Examples of hazards include but are not limited to: moving machine parts, power take-off (PTO), electricity, farm machinery and vehicle traffic, fires in farm buildings, applications of organic fertilizer, excessive noise, dust, vibrations, extreme temperatures, ladders, fuel storage, slurry tanks, etc. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Worker Health and Safety Risk AssessmentPA-DC-05 - Issued: 2/17/16Includes Heat and Hydration, Physical/Ergonomics, Chemical/Pesticides, Machinery/Fuel/Electricity, Injuries from Equipment, Minor Injuries, and Respiratory.'
    },
    'AF 4.1.2': {
      question_name:
        'Does the farm have written health and safety procedures addressing issues identified in the risk assessment of AF 4.1.1?',
      criteria: [
        'The health and safety procedures shall address the points identified in the risk assessment (AF 4.1.1) and shall be appropriate for the farming operations. They shall also include accident and emergency procedures as well as contingency plans that deal with any identified risks in the working situation, etc. The procedures shall be reviewed annually and updated when the risk assessment changes.The farm infrastructure, facilities and equipment shall be constructed and maintained in such a way as to minimize health and safety hazards for the workers to the extent practical.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Control Measures are listed with each risk identified in the Worker Health and Safety Risk Assessment. Corresponding procedures and work instructions were listed with each Category.Work Instructions:PA-IT-21 - Issued: 2/17/16Include Procedures for Production and Harvest and Pesticide Handling.'
    },
    'AF 4.1.3': {
      question_name:
        'Have all people working on the farm received health and safety training according to the risk assessment in AF 4.1.1?',
      criteria: [
        'All workers, including subcontractors, can demonstrate competency in responsibilities and tasks through visual observation (if possible on the day of the inspection). There shall be evidence of instructions in the appropriate language and training records. Producers may conduct the health and safety training themselves if training instructions or other training materials are available (i.e. it need not be an outside individual who conducts the training). No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Training Log GI-FR-07Example Date:1/5/16Topic: Agriculture Safety Seminars, Given by Oregon Agriculture Industry Participants:4 Year round EmployeesInstructor: Kevin White. SAIF Corporation. Pesticide Applicators Training for 4 year round employees. Cleaning of PPE training.'
    },
    'AF 4.2.1': {
      question_name:
        'Is there a record kept for training activities and attendees?',
      criteria: [
        'A record is kept for training activities, including the topic covered, the trainer, the date and a list of the attendees. Evidence of attendance is required.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'See AF 3.3 and AF 4.1.3.'
    },
    'AF 4.2.2': {
      question_name:
        'Do all workers handling and/or administering veterinary medicines, chemicals, disinfectants, plant protection products, biocides and/or other hazardous substances and all workers operating dangerous or complex equipment as defined in the risk analysis in AF 4.1.1 have evidence of competence or details of other such qualifications?',
      criteria: [
        'Records shall identify workers who carry out such tasks, and can demonstrate competence (e.g. certificate of training and/or records of training with proof of attendance). This shall include compliance with applicable legislation. No N/A.For aquaculture, cross-reference with Aquaculture Module AB 4.1.1.In livestock, for workers administering medicines proof of adequate experience is also required'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'John Smith- Private Applicators Lic.. # AG- L0164626PAL Exp. 12/31/16. Pesticide Applicators Training given by Jose Montano on 6/2/16 to employees on farm about safety and handling of pesticide.'
    },
    'AF 4.3.1': {
      question_name:
        'Do accident and emergency procedures exist? Are they visually displayed, and are they communicated to all persons associated with the farm activities, including subcontractors and visitors?',
      criteria: [
        'Permanent accident procedures shall be clearly displayed in accessible and visible location(s) for workers, visitors and subcontractors. These instructions are available in the predominant language(s) of the workforce and/or pictograms. The procedures shall identify, the following:- The farm map reference or farm address- The contact person(s).- An up-to-date list of relevant phone numbers (police, ambulance, hospital, fire-brigade, access to emergency health care on site or by means of transport, supplier of electricity, water and gas).Examples of other procedures that can be included:- The location of the nearest means of communication (telephone, radio).- How and where to contact the local medical services, hospital and other emergency services. (WHERE did it happen? WHAT happened? HOW MANY injured people? WHAT kind of injuries? WHO is calling?).- The location of fire extinguisher(s).- The emergency exits.- Emergency cut-offs for electricity, gas and water supplies. - How to report accidents and dangerous incidents.For aquaculture, cross-reference with Aquaculture Module AB 3.1.4.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Work Instructions:PA-IT-21 - Issued: 2/17/16Include signage for Procedures for Production and Harvest and Pesticide Handling.'
    },
    'AF 4.3.2': {
      question_name:
        'Are potential hazards clearly identified by warning signs?',
      criteria: [
        'Permanent and legible signs shall indicate potential hazards. This shall include, where applicable: waste pits, fuel tanks, workshops, and access doors of the storage facilities for plant protection products/fertilizers/any other chemicals. Warning signs shall be present and in the predominant language(s) of the workforce and/or in pictograms. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Work Instructions:PA-IT-21 - Issued: 2/17/16Include signage for Procedures for Production and Harvest and Pesticide Handling.'
    },
    'AF 4.3.3': {
      question_name:
        'Is safety advice for substances hazardous to workers’ health available/accessible?',
      criteria: [
        'When required to ensure appropriate action, information (e.g. website, telephone number, material safety data sheets, etc.) is accessible.For aquaculture, cross-reference with Aquaculture Module AB 3.1.2.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'MSDS kept in shop.'
    },
    'AF 4.3.4': {
      question_name:
        'Are first aid kits available at all permanent sites and in the vicinity of fieldwork?',
      criteria: [
        'Complete and maintained first aid kits (i.e. according to local recommendations and appropriate to the activities being carried out on the farm) shall be available and accessible at all permanent sites and readily available for transport (tractor, car, etc.) where required by the risk assessment in AF 4.1.1.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'First aid kits were available in shop, field and pesticide shed.'
    },
    'AF 4.3.5': {
      question_name:
        'Are there always an appropriate number of persons (at least one person) trained in first aid present on each farm whenever on-farm activities are being carried out?',
      criteria: [
        'There is always at least one person trained in first aid (i.e. within the last 5 years) present on the farm whenever on-farm activities are being carried out. As a guideline: one trained person per 50 workers. On-farm activities include all activities mentioned in the relevant modules of this Standard.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Jane Doe and John Smith are both trained in First aid, however, training cards/licenses were expired. Awaiting new training. / CORRECTED 8/12/16. First aid training certificate was submitted for Patty Laskey. Training attended on 8/12/16 ( 2 year expiration).'
    },
    'AF 4.4.1': {
      question_name:
        'Are workers, visitors and subcontractors equipped with suitable protective clothing in accordance with legal requirements and/or label instructions and/or as authorized by a competent authority?',
      criteria: [
        'Complete sets of protective clothing, which enable label instructions and/or legal requirements and/or requirements as authorized by a competent authority to be complied witch are available on the farm, utilized, and in a good state of repair. To comply with label requirements and/or on-farm operations, this may include some of the following: rubber boots or other appropriate footwear, waterproof clothing, protective overalls, rubber gloves, face masks, appropriate respiratory equipment (including replacement filters), ear and eye protection devices, life-jackets, etc. as required by label or on-farm operations.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Helmet with respirator, respirator. Gloves, Tyvek Suit.'
    },
    'AF 4.4.2': {
      question_name:
        'Is protective clothing cleaned after use and stored in such a way as to prevent contamination of personal clothing?',
      criteria: [
        'Protective clothing is kept clean according to the type of use and degree of potential contamination and in a ventilated place. Cleaning protective clothing and equipment includes separate washing from private clothing. Wash re-usable gloves before removal. Dirty and damaged protective clothing and equipment and expired filter cartridges shall be disposed of appropriately. Single-use items (e.g. gloves, overalls) shall be disposed of after one use. All protective clothing and equipment including replacements filters, etc. shall be stored outside of the plant protection products/storage facility and physically separated from any other chemicals that might cause contamination of the clothing or equipment. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Work Instructions: Cleaning of Personal Protection EquipmentPA-IT-23 - Issued: 2/05/16Detailed instructions for the respirator, face shield/goggles, rubber boots/gloves, protective clothing/garments,'
    },
    'AF 4.5.1': {
      question_name:
        'Is a member of management clearly identifiable as responsible for the workers’ health, safety and welfare?',
      criteria: [
        'Documentation is available that clearly identifies and names the member of management who is responsible for ensuring compliance with and implementation of existing, current and relevant national and local regulations on workers’ health, safety and welfare.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'John Smith the person responsible for Worker Health, Safety, and Welfare. Dated 7/13/16'
    },
    'AF 4.5.2': {
      question_name:
        'Does regular two-way communication take place between management and workers on issues related to workers’ health, safety and welfare? Is there evidence of actions taken from such communication?',
      criteria: [
        'Records show that communication between management and workers about health, safety and welfare concerns can take place openly (i.e. without fear of intimidation or retribution) and at least once a year. The auditor is not required to make judgments about the content, accuracy or outcome of such communications. There is evidence that the concerns of the workers about health, safety and welfare are being addressed.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Communication Log Template. 6/30/16 between Jane Doe and John Smith and John Doe.'
    },
    'AF 4.5.3': {
      question_name:
        'Do workers have access to clean food storage areas, designated rest areas, hand-washing facilities, and drinking water?',
      criteria: [
        'A place to store food and a place to eat shall be provided to the workers if they eat on the farm. Hand washing equipment and drinking water shall always be provided.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Workers have lunch area in shop and also temporary eating area outside growing area.'
    },
    'AF 4.5.4': {
      question_name:
        'Are on-site living quarters habitable and have the basic services and facilities?',
      criteria: [
        'The on-farm living quarters for the workers are habitable and have a sound roof, windows and doors, and the basic services of drinking water, toilets, and drains. In the case of no drains, septic pits can be accepted if compliant with local regulations.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No on-site living quarters.'
    },
    'AF 4.5.5': {
      question_name:
        'Is transport for workers (on-farm, to and from fields/orchard) as provided by the producer safe and compliant with national regulations when used to transport workers on public roads?',
      criteria: [
        'Vehicles or vessels shall be safe for workers and, when used to transport workers on public roads, shall comply with national safety regulations.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No transport is provided.'
    },
    'AF 5.1': {
      question_name:
        'When the producer makes use of subcontractors, does he/she oversee their activities in order to ensure that those activities relevant to GLOBALG.A.P. CPCCs comply with the corresponding requirements?',
      criteria: [
        'The producer is responsible for observing the control points applicable to the tasks performed by the subcontractors who carry out activities covered in the GLOBALG.A.P. Standard, by checking and signing the assessment of the subcontractor for each task and season contracted.Evidence of compliance with the applicable control points shall be available on the farm during the external inspection.i) The producer can perform the assessment and shall keep the evidence of compliance of the control points assessed. The subcontractor shall agree that GLOBALG.A.P. approved certifiers are allowed to verify the assessments through a physical inspection; orii) A third-party certification body, which is GLOBALG.A.P. approved, can inspect the subcontractor. The subcontractor shall receive a letter of conformance from the certification body with the following info: 1) Date of assessment, 2) Name of the certification body, 3) Inspector name, 4) Details of the subcontractor, and 5) List of the inspected Control Points and Compliance Criteria. Certificates issued to subcontractors against standards that are not officially approved by GLOBALG.A.P. are not valid evidence of compliance with GLOBALG.A.P'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Oregon Harvesting Inc. (FLC)- Information packet containing business license, GAP training, harvesting policies and procedures, training topics given to berry pickers all included. No agreement/assessment was available for Shulz, AAT Ag, and Peerbolt Crop Management. / CORRECTED 8/2/16 Shulz Water Service- Toilet cleaning procedure was provided. AAT Agriculture (FLC)-Business licenses, Food Safety Workshop for Labor Contractors-Stockton, CA. Bucket cleaning procedure was available for harvest equipment. Peerbolt Crop Management- Scouting services provided for fields. Description of services document was made available.'
    },
    'AF 6.1.1': {
      question_name:
        'Have possible waste products and sources of pollution been identified in all areas of the farm?',
      criteria: [
        'Possible waste products (e.g. paper, cardboard, plastic, oil) and sources of pollution (e.g. fertilizer excess, exhaust smoke, oil, fuel, noise, effluent, chemicals, sheep-dip, feed waste, algae produced during net cleaning) produced by the farm processes have been listed.For crops, producers shall also take into consideration surplus application mix and tank washings.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Waste Management PlanPA-FR-17 Issued 4/1/15Includes sections for the Sources, Wastes Generated, and the Management of those wastes.Empty containers, paper towels, food containers, batteries, oil cans, filters, old tries.'
    },
    'AF 6.2.1': {
      question_name:
        'Is there a documented farm waste management plan to avoid and/or minimize wastage and pollution to the extent possible, and does the waste management plan include adequate provisions for waste disposal?',
      criteria: [
        'A comprehensive, current, and documented plan that covers wastage reduction, pollution and waste recycling is available. Air, soil, and water contamination shall be considered where relevant along with all products and sources identified in the plan. For aquaculture, cross-reference with Aquaculture Module AB 9.1.1.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Waste Management Plan PA-FR-17 Issued 4/1/15 Includes sections for the Sources, Wastes Generated, and the Management of those wastes.Empty Containers-Wilcow Recycling'
    },
    'AF 6.2.2': {
      question_name: 'Is the site kept in a tidy and orderly condition?',
      criteria: [
        'Visual assessment shall show that there is no evidence of waste/litter in the immediate vicinity of the production site(s) or storage buildings. Incidental and insignificant litter and waste on the designated areas are acceptable as well as the waste from the current day’s work. All other litter and waste shall be cleared up, including fuel spills.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Site was clean and organized.'
    },
    'AF 6.2.3': {
      question_name:
        'Are holding areas for diesel and other fuel oil tanks environmentally safe?',
      criteria: [
        'All fuel storage tanks shall conform to the local requirements. When there are no local requirements to contain spillage, the minimum is bunded areas, which shall be impervious and be able to contain at least 110% of the largest tank stored within it, unless it is in an environmentally sensitive area where the capacity shall then be 165% of the content of the largest tank. There shall be no-smoking signs displayed and appropriate fire emergency provisions made nearby.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'no',
        units: 'yes-no-n_a'
      },
      justification: 'No secondary containment was available for fuel storage.'
    },
    'AF 6.2.4': {
      question_name:
        'Provided there is no risk of pest, disease and weed carry-over, are organic wastes composted on the farm and recycled?',
      criteria: [
        'Organic waste material is composted and used for soil conditioning. The composting method ensures that there is no risk of pest, disease or weed carry-over. For aquaculture, cross-reference with Aquaculture Module AB 10.2.2.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No organic waste is composted.'
    },
    'AF 6.2.5': {
      question_name:
        'Is the water used for washing and cleaning purposes disposed of in a manner that ensures the minimum health and safety risks and environmental impact?',
      criteria: [
        'Waste water resulting from washing of contaminated machinery, e.g. spray equipment, personal protective equipment, hydro-coolers, or buildings with animals, should be collected and disposed of in a way that ensures the minimum impact on the environment and the health and safety of farm staff, visitors and nearby communities as well as legal compliance. For tank washings see CB 7.5.1.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Designated wash area is used. 10 by 10 section with 12 inches of sand and 2 feet of gravel used for minimizing contamination.'
    },
    'AF 7.1.1': {
      question_name:
        'Does each producer have a wildlife management and conservation plan for the farm business that acknowledges the impact of farming activities on the environment?',
      criteria: [
        'There shall be a written action plan that aims to enhance habitats and maintain biodiversity on the farm. This can be either an individual plan or a regional activity that the farm is participating in or is covered by. It shall pay special attention to areas of environmental interest being protected and make reference to legal requirements where applicable. The action plan shall include knowledge of integrated pest management practices, nutrient use of crops, conservation sites, water supplies, the impact on other users, etc.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Wildlife Management and Conservation Plan PA-DC-01 Issued 2/17/16Provides growers with a dozen practices that may maintain habitats (Avoid cutting down trees, use of mulch to avoid erosion) or enhance biodiversity (Planting additional foliage in ditches or around crop). Listed practices were appropriate and visually confirmed in use at the sites.'
    },
    'AF 7.1.2': {
      question_name:
        'Has the producer considered how to enhance the environment for the benefit of the local community and flora and fauna? Is this policy compatible with sustainable commercial agricultural production and does it strive to minimize environmental impact of the agricultural activity?',
      criteria: [
        'There should be tangible actions and initiatives that can be demonstrated 1) by the producer either on the production site or at the local scale or at the regional scale 2) by participation in a group that is active in environmental support schemes concerned with habitat quality and habitat elements. There is a commitment within the conservation plan to undertake a baseline audit of the current levels, location, condition etc. of the fauna and flora on the farm, so as to enable actions to be planned. Within the conservation plan, there is a clear list of priorities and actions to enhance habitats for fauna and flora where viable and to increase bio-diversity on the farm.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'no',
        units: 'yes-no-n_a'
      },
      justification:
        'No tangible actions or initiatives were presented. No commitment for a baseline audit of flora or fauna.'
    },
    'AF 7.2.1': {
      question_name:
        'Has consideration been given to the conversion of unproductive sites (e.g. low-lying wet areas, woodlands, headland strips, or areas of impoverished soil, etc.) to ecological focus areas for the encouragement of natural flora and fauna?',
      criteria: [
        'There should be a plan to convert unproductive sites and identified areas that give priority to ecology into conservation areas where viable.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No unproductive sites.'
    },
    'AF 7.3.1': {
      question_name: 'Can the producer show monitoring of on-farm energy use?',
      criteria: [
        'Energy use records exist (e.g. invoices where energy consumption is detailed). The producer/producer group is aware of where and how energy is consumed on the farm and through farming practices. Farming equipment shall be selected and maintained for optimum energy consumption.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Energy records were available. Eg., PGE.'
    },
    'AF 7.3.2': {
      question_name:
        'Based on the result of the monitoring, is there a plan to improve energy efficiency on the farm?',
      criteria: [
        'A written plan identifying opportunities to improve energy efficiency is available.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'no',
        units: 'yes-no-n_a'
      },
      justification:
        'No plan to identify opportunities for improving energy efficiency was available.'
    },
    'AF 7.3.3': {
      question_name:
        'Does the plan to improve energy efficiency consider minimizing the use of non-renewable energy?',
      criteria: [
        'Producers consider reducing the use of non-renewable energies to a minimum possible and use renewable ones.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'no',
        units: 'yes-no-n_a'
      },
      justification:
        'No plan to identify opportunities for improving energy efficiency.'
    },
    'AF 7.4.1': {
      question_name:
        'Where feasible, have measures been implemented to collect water and, where appropriate, to recycle taking into consideration all food safety aspects?',
      criteria: [
        'Water collection is recommended where it is commercially and practically feasible, e.g. from building roofs, glasshouses etc. Collection from watercourses within the farm perimeters may need legal permits from the authorities.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No water collection systems.'
    },
    'AF 8.1': {
      question_name:
        'Is there a complaint procedure available relating to both internal and external issues covered by the GLOBALG.A.P. Standard and does this procedure ensure that complaints are adequately recorded, studied, and followed up, including a record of actions taken?',
      criteria: [
        'A documented complaint procedure is available to facilitate the recording and follow-up of all received complaints relating to issues covered by GLOBALG.A.P. actions taken with respect to such complaints. In the case of producer groups, the members do not need the complete complaint procedure, but only the parts that are relevant to them. The complaint procedure shall include the notification of GLOBALG.A.P. Secretariat via the certification body in the case that the producer is informed by a competent or local authority that he/she is under investigation and/or has received a sanction in the scope of the certificate. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        "Driscoll's handles all product complaints through a consumer hotline.Managing Nonconformities and Complaints GI-PO-04 Issued 2/3/16 A process flow diagram outlines procedures for deviations from procedures, audits, and customer complaints."
    },
    'AF 9.1': {
      question_name:
        'Does the producer have documented procedures on how to manage/initiate the withdrawal/recall of certified products from the marketplace and are these procedures tested annually?',
      criteria: [
        'The producer shall have a documented procedure that identifies the type of event that may result in a withdrawal/recall, the persons responsible for making decisions on the possible product withdrawal/recall, the mechanism for notifying the next step in the supply chain and the GLOBALG.A.P. approved certification body, and the methods of reconciling stock. The procedures shall be tested annually to ensure that they are effective. This test shall be recorded (e.g. by picking a recently sold batch, identifying the quantity and whereabouts of the product, and verifying whether the next step involved with this batch and the CB can be contacted. Actual communications of the mock recall to the clients are not necessary. A list of phone numbers and emails is sufficient). No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Product Recall GI-PO-06 April 1, 2016Activities include: Prior steps, Recall Communication, Investigation, Notifying Customers, and Customer Complaints.The Mock recall was conducted on 6/20/16 by Happy Berry Packing. All relevant documentation was available. Product was accounted for.'
    },
    'AF 10.1': {
      question_name:
        'Is there a risk assessment for food defense and are procedures in place to address identified food defense risks?',
      criteria: [
        'Potential intentional threats to food safety in all phases of the operation shall be identified and assessed. Food defense risk identification shall assure that all input is from safe and secured sources. Information of all employees and subcontractors shall be available. Procedures for corrective action shall be in place in case of intentional threat.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Food DefensePA-DC-02 Issued: 2/17/16Risk considered include entrances, visitors, strangers, contamination, pesticide and fertilizer storage, packaging materials, and intentional contamination.Entrance to ranch, visitors on ranch and strangers on ranch . Mitigation techniques listed.'
    },
    'AF 11.1': {
      question_name:
        'Does all transaction documentation include reference to the GLOBALG.A.P. status and the GGN?',
      criteria: [
        'Sales invoices and, where appropriate, other documentation related to sales of certified material/products shall include the GGN of the certificate holder AND a reference to the GLOBALG.A.P. certified status. This is not obligatory in internal documentation.Where producers own a GLN, this shall replace the GGN issued by GLOBALG.A.P. during the registration process.Positive identification of the certified status is enough on transaction documentation (e.g.: ‘‘GLOBALG.A.P. certified <product name>’’). Non-certified products do not need to be identified as "non-certified". Indication of the certified status is obligatory regardless of whether the certified product was sold as certified or not. This cannot be checked during the initial (first ever) inspection, because the producer is not certified yet and the producer cannot reference to the GLOBALG.A.P. certified status before the first positive certification decision.N/A only when there is a written agreement available between the producer and the client not to identify the GLOBALG.A.P. status of the product and/or the GGN on the transaction documents.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        "Logo Use Agreement was available from Driscoll's, that the individual growers do not need to identify their GGN on transaction documentation."
    },
    'AF 12.1': {
      question_name:
        'Is the GLOBALG.A.P. word, trademark, GLOBALG.A.P. QR code or logo and the GGN (GLOBALG.A.P. Number) used according to the GLOBALG.A.P. General Regulations and according to the Sublicense and Certification Agreement?',
      criteria: [
        'The producer/producer group shall use the GLOBALG.A.P. word, trademark, GLOBALG.A.P. QR code or logo and the GGN (GLOBALG.A.P. Number), GLN or sub-GLN according to the General Regulations Annex 1 and according to the Sublicense and Certification Agreement. The GLOBALG.A.P. word, trademark or logo shall never appear on the final product, on the consumer packaging, or at the point of sale. However, the certificate holder can use any and/or all in business-to-business communications. GLOBALG.A.P. word, trademark or logo cannot be in use during the initial (first ever) inspection because the producer is not certified yet and the producer cannot reference to the GLOBALG.A.P. certified status before the first positive certification decision.N/A for CFM, PPM, GLOBALG.A.P. Aquaculture ova or seedlings and Livestock, when the certified products are input products, not intended for sale to final consumers and will definitely not appear at the point of sale to final consumers.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        "Driscoll's provides all consumer packaging and confirms certification status does not appear on any transaction documents or packaging."
    },
    'AF 13.1': {
      question_name:
        'Is there an effective system in place to identify and segregate all GLOBALG.A.P. certified and non-certified products?',
      criteria: [
        'A system shall be in place to avoid mixing of certified and non-certified products. This can be done via physical identification or product handling procedures, including the relevant records.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - No parallel production or ownership - all grower properties are certified.'
    },
    'AF 13.2': {
      question_name:
        'In the case of producers registered for parallel production/ownership (where certified and non-certified products are produced and/or owned by one legal entity), is there a system to ensure that all final products originating from a certified production process are correctly identified?',
      criteria: [
        'In the case the producer is registered for parallel production/ownership (where certified and non-certified products are produced and/or owned by one legal entity), all product packed in final consumer packaging (either from farm level or after product handling) shall be identified with a GGN where the product originates from a certified process. It can be the GGN of the (Option 2) group, the GGN of the group member, both GGNs, or the GGN of the individual (Option 1) producer. The GGN shall not be used to label non-certified products.N/A only when the producer only owns GLOBALG.A.P. products (no PP/PO), or when there is a written agreement available between the producer and the client not to use the GGN, GLN or sub-GLN on the ready to be sold product. This can also be the client own label specifications where the GGN is not included.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - No parallel production or ownership - all grower properties are certified.'
    },
    'AF 13.3': {
      question_name:
        'Is there a final check to ensure the correct product dispatch of certified and non-certified products?',
      criteria: [
        'The check shall be documented to show that the certified and non-certified products are dispatched correctly.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - No parallel production or ownership - all grower properties are certified.'
    },
    'AF 13.4': {
      question_name:
        'Are appropriate identification procedures in place and records for identifying products purchased from different sources available for all registered products?',
      criteria: [
        'Procedures shall be established, documented and maintained, appropriately to the scale of the operation, for identifying certified and, when applicable, non-certified quantities purchased from different sources (i.e. other producers or traders) for all registered products.Records shall include:- Product description- GLOBALG.A.P. certified status- Quantities of product(s) purchased- Supplier details- Copy of the GLOBALG.A.P. Certificates where applicable- Traceability data/codes related to the purchased products- Purchase orders/invoices received by the organization being assessed- List of approved suppliers'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - No parallel production or ownership - all grower properties are certified.'
    },
    'AF 14.1': {
      question_name:
        'Are sales records available for all quantities sold and all registered products?',
      criteria: [
        'Sales details of certified and, when applicable, non-certified quantities shall be recorded for all registered products, with particular attention to quantities sold and descriptions provided. The documents shall demonstrate the consistent balance between the certified and non-certified input and the output. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'No PP, purchased product, or product storage. Pack out report was provided. Report indicates gross weight vs. net weights. Sales records shown. Eg., 7/5/16 Pay Weight 2,352.67'
    },
    'AF 14.2': {
      question_name:
        'Are quantities (produced, stored and/or purchased) recorded and summarized for all products?',
      criteria: [
        'Quantities (including information on volumes or weight) of certified, and when applicable non-certified, incoming (including purchased products), outgoing and stored products shall be recorded and a summary maintained for all registered products, so as to facilitate the mass balance verification process. The frequency of the mass balance verification shall be defined and be appropriate to the scale of the operation, but It shall be done at least annually per product. Documents to demonstrate mass balance shall be clearly identified. This control point applies to all GLOBALG.A.P. producers.No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        "No PP, purchased product, or product storage.All product sold to Driscoll's.Pack house/cooler receipt shows volume of fruit received:Eg., 7/5/16 Net Weight= 2352.67 vs. gross 2473.05Pack out reports also shows total flats in and flats out."
    },
    'AF 14.3': {
      question_name:
        'Are conversion ratios and/or loss (input-output calculations of a given production process) during handling calculated and controlled?',
      criteria: [
        'Conversion ratios shall be calculated and available for each relevant handling process. All generated product waste quantities shall be estimated and/or recorded. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Pounds culled: Eg., 7/5/16 Total Deducts 120.38.'
    },
    'AF 15.1': {
      question_name:
        'Has the producer completed and signed the Food Safety Policy Declaration included in the IFA checklist?',
      criteria: [
        'Completion and signature of the Food Safety Policy Declaration is a commitment to be renewed annually for each new certification cycle. For an Option 1 producer, without implemented QMS, the self-assessment checklist will only be complete when the Food Safety Policy Declaration is completed and signed. In the case of producer groups (Option 2) and Option 1 multisite producers with implemented QMS, it is possible that the central management assumes this commitment for the organization and for all its members by completing and signing one declaration at QMS level. In that case, the members of the producer groups and the individual production sites are not required to complete and sign the declaration individually. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Food Safety Policy Declaration was signed by John Smith on 6/16/16.'
    },
    'AF 16.1': {
      question_name:
        'Does the producer have a food fraud vulnerability risk assessment?',
      criteria: [
        'A documented risk assessment to identify potential vulnerability to food fraud (e.g. counterfeit PPP or propagation material, non-food grade packaging material) is available, current and implemented. This procedure may be based on a generic one, but shall be customized to the scope of the production'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'no',
        units: 'yes-no-n_a'
      },
      justification:
        'No assessment procedure was available to identify potential vulnerability to food fraud.'
    },
    'AF 16.2': {
      question_name:
        'Does the producer have a food fraud mitigation plan and has it been implemented?',
      criteria: [
        'A documented food fraud mitigation plan, specifying the measures the producer has implemented to address the food fraud threats identified is available and implemented.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'no',
        units: 'yes-no-n_a'
      },
      justification:
        'No assessment procedure was available to identify potential vulnerability to food fraud.'
    },
    'CB 1.1': {
      question_name:
        'Is GLOBALG.A.P. registered product traceable back to and trackable from the registered farm (and other relevant registered areas) where it has been produced and, if applicable, handled?',
      criteria: [
        'There is a documented identification and traceability system that allows GLOBALG.A.P. registered products to be traced back to the registered farm or, in a farmer group, to the registered farms of the group, and tracked forward to the immediate customer (one step up, one step down). Harvest information shall link a batch to the production records or the farms of specific producers. (Refer to General Regulations Part II for information on segregation in Option 2). Produce handling shall also be covered, if applicable. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Lot Code Traceability is described and allows for tracking to the production area, ranch, and harvest date. Ranch code numbers allow for centralized maintenance of production records.'
    },
    'CB 2.1.1': {
      question_name:
        'When seeds or propagation material have been purchased in the past 24 months, is there evidence that guarantees they have been obtained in compliance with variety registration laws (in the case mandatory variety registration exists in the respective country)?',
      criteria: [
        'A document (e.g. empty seed package or plant passport or packing list or invoice) that states as a minimum variety name, batch number, propagation material vendor, and, where available, additional information on seed quality (germination, genetic purity, physical purity, seed health, etc.) shall be available.Material coming from nurseries that have GLOBALG.A.P. Plant Propagation Material, equivalent or GLOBALG.A.P. recognized certification are considered compliant.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'NA. No propagation material purchased in previous 24 months.'
    },
    'CB 2.1.2': {
      question_name:
        'Has the propagation material used been obtained in accordance to applicable intellectual property laws?',
      criteria: [
        'When producers use registered varieties or rootstock, there are written documents available on request that prove that the propagation material used has been obtained in accordance to applicable local intellectual property right laws. These documents may be the license contract (for starting material that does not originate from seed, but from vegetative origin), the plant passport if applicable or, if a plant passport is not required, a document or empty seed package that states, as a minimum, variety name, batch number, propagation material vendor and packing list/delivery note or invoice to demonstrate size and identity of all propagation material used in the last 24 months. No N/A.Note: The PLUTO Database of UPOV (http://www.upov.int/pluto/en) and the Variety Finder Tool on the website of CPVO (cpvo.europa.eu) list all varieties in the world, providing their registration details and the Intellectual Property Protection details per variety and country.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'NA. No propagation material purchased in previous 24 months.'
    },
    'CB 2.1.3': {
      question_name:
        'Are plant health quality control systems operational for in-house nursery propagation?',
      criteria: [
        'A quality control system that contains a monitoring system for visible signs of pest and diseases is in place and current records of the monitoring system shall be available. Nursery means anywhere propagation material is produced, (including in-house grafting material selection). The monitoring system shall include the recording and identification of the mother plant or field of origin crop, as applicable. Recording shall be at regular established intervals. If the cultivated trees or plants are intended for own use only (i.e. not sold), this will suffice. When rootstocks are used, special attention shall be paid to the origin of the rootstocks through documentation'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        "No in-house nursery. Driscoll's provides propagation material to the majority of growers."
    },
    'CB 2.2.1': {
      question_name:
        'Is the purchased propagation material (seed, rootstocks, seedlings, plantlets, cuttings) accompanied by information of chemical treatments done by the supplier?',
      criteria: [
        'Records with the name(s) of the chemical product(s) used by the supplier on the propagation material (e.g. maintaining records/ seed packages, list with the names of the PPP used, etc.) are available on request. Suppliers who hold a GLOBALG.A.P. Plant Propagation Material, equivalent or GLOBALG.A.P. recognized certificate are considered compliant with the Control Point. NA for perennial crops.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'NA. No propagation material purchased in previous 24 months.'
    },
    'CB 2.2.2': {
      question_name:
        'Are plant protection product treatments recorded for in-house nursery propagation materials applied during the plant propagation period?',
      criteria: [
        'Records of all plant protection product treatments applied during the plant propagation period for in-house plant nursery propagation are available and include location, date, trade name and active ingredient, operator, authorized by, justification, quantity and machinery used'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No in-house nursery.'
    },
    'CB 2.3.1': {
      question_name:
        'Does the planting of or trials with GMOs comply with all applicable legislation in the country of production?',
      criteria: [
        'The registered farm or group of registered farms have a copy of the legislation applicable in the country of production and comply accordingly. Records shall be kept of the specific modification and/or the unique identifier. Specific husbandry and management advice shall be obtained'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'N/A - No GMO in use.'
    },
    'CB 2.3.2': {
      question_name:
        'Is there documentation available of when the producer grows genetically modified organisms?',
      criteria: [
        'If GMO cultivars and/or products derived from genetic modification are used, records of planting, use or production of GMO cultivars and/or products derived from genetic modification are maintained.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: '',
        units: 'yes-no-n_a'
      },
      justification: 'N/A - No GMO in use'
    },
    'CB 2.3.3 ': {
      question_name:
        'Have the producer’s direct clients been informed of the GMO status of the product?',
      criteria: [
        'Documented evidence of communication shall be provided and shall allow verification that all material supplied to direct clients is according to customer requirements.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'N/A - No GMO in use'
    },
    'CB 2.3.4': {
      question_name:
        'Is there a plan for handling GM material (i.e. crops and trials) identifying strategies to minimize contamination risks (e.g. such as accidental mixing of adjacent non-GM crops) and maintaining product integrity?',
      criteria: [
        'A written plan that explains how GM materials (e.g. crops and trials) are handled and stored to minimize risk of contamination with conventional material and to maintain product integrity is available.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'N/A - No GMO in use'
    },
    'CB 2.3.5': {
      question_name:
        'Are GMO crops stored separately from other crops to avoid adventitious mixing?',
      criteria: [
        'A visual assessment of the integrity and identification of genetically modified (GMO) crops storage shall be made.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'N/A - No GMO in use'
    },
    'CB 3.1': {
      question_name: 'Does the producer have a soil management plan?',
      criteria: [
        'The producer shall demonstrate that consideration has been given to the nutritional needs of the crop and to maintaining soil fertility. Records of analyses and/or crop-specific literature shall be available as evidence. Flowers and ornamentals producers shall perform calculations at least once for every single crop harvested and on a justified regular basis (e.g. every two weeks in closed systems) for continuously harvested crops. (Analysis may be conducted with on-farm equipment or mobile kits). No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Soil and plant analysis conducted on 10/7/15.'
    },
    'CB 3.2': {
      question_name: 'Have soil maps been prepared for the farm?',
      criteria: [
        'The types of soil are identified for each site, based on a soil profile or soil analysis or local (regional) cartographic soil-type map.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Soil analysis were available for sites.'
    },
    'CB 3.3': {
      question_name:
        'Is there, where feasible, crop rotation for annual crops?',
      criteria: [
        'When rotations of annual crops to improve soil structure and minimize soil borne pests and diseases are done, this can be verified from planting date and/or plant protection product application records. Records shall exist for the previous 2-year rotation.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. Perennial Crop.'
    },
    'CB 3.4': {
      question_name:
        'Have techniques been used to improve or maintain soil structure and avoid soil compaction?',
      criteria: [
        'There is evidence of techniques applied (e.g. use of deep-rooting green crops, drainage, subsoiling, use of low pressure tires, tramlines, permanent row marking, avoiding in-row plowing, smearing, poaching,) that are suitable for use on the land and, where possible, minimize, isolate or eliminate soil compaction, etc.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Soil Structure and Erosion Control PlanPA-FR-18 Issued: 2/17/16Lists potential practices for growers such as use of wide tires, aeration, and rippers.'
    },
    'CB 3.5': {
      question_name:
        'Does the producer use techniques to reduce the possibility of soil erosion?',
      criteria: [
        'There is evidence of control practices and remedial measures (e.g. mulching, cross line techniques on slopes, drains, sowing grass or green fertilizers, trees and bushes on borders of sites, etc.) to minimize soil erosion (e.g. water, wind).'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Soil Structure and Erosion Control PlanPA-FR-18 Issued: 2/17/16Lists potential practices for growers such as drip irrigation, bed slope directions, and leveling.'
    },
    'CB 3.6': {
      question_name:
        'Has the producer taken into account the nutrient contribution of organic fertilizer applications?',
      criteria: [
        'An analysis from the supply is carried out or recognized standard values are used, which take into account the contents of NPK nutrients (nitrogen (N), phosphorus (P), potassium (K)) in organic fertilizer applied in order to avoid soil contamination.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No organic fertilizer is used'
    },
    'CB 3.7': {
      question_name:
        'Does the producer keep records on seed/planting rate, sowing/planting date?',
      criteria: [
        'Records of sowing/planting, rate/density, and date shall be kept and be available.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. Over 2 years since last planting was conducted.'
    },
    'CB 4.1.1': {
      question_name:
        'Are recommendations for the application of fertilizers (organic or inorganic) provided by competent and qualified persons?',
      criteria: [
        'Where the fertilizer records show that the technically responsible person determining quantity and type of the fertilizer (organic or inorganic) is an external adviser, training and technical competence shall be demonstrated via official qualifications, specific training courses, etc., unless employed for that purpose by a competent organization (e.g. official advisory services).Where the fertilizer records show that the technically responsible person determining quantity and type of fertilizer (organic or inorganic) is the producer, experience shall be complemented by technical knowledge (e.g. access to product technical literature, specific training course attendance, etc.) and/or the use of tools (software, on farm detection methods, etc.).'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'John R Smith- Pesticide Consultant. Lic.. # AG-L0093411PC Exp. 12/31/16.'
    },
    'CB 4.2.1': {
      question_name: 'Field, orchard or greenhouse reference and crop?',
      criteria: [
        'Records shall be kept of all fertilizer applications, detailing the geographical area and the name or reference of the field, orchard or greenhouse where the registered product crop is located. Records shall also be kept for hydroponic situations and where fertigation is used. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Fertilizer Application LogPA-FR-07Ranch/Bock: All blocks'
    },
    'CB 4.2.2': {
      question_name: 'Application dates?',
      criteria: [
        'The exact dates (day, month and year) of the application are detailed in the records of all fertilizer applications. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Fertilizer Application LogPA-FR-07Date: 7/17/16'
    },
    'CB 4.2.3': {
      question_name: 'Applied fertilizer types?',
      criteria: [
        'The trade name, type of fertilizer (e.g. NPK), and concentrations (e.g. 17-17-17) are detailed in the records of all fertilizer applications. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Fertilizer Application LogPA-FR-07Fertilizer formula: 0-52-34'
    },
    'CB 4.2.4': {
      question_name: 'Applied quantities?',
      criteria: [
        'The amount of product to be applied in weight or volume relative to a unit of area or number of plants or unit of time per volume of fertigation is detailed in the records of all fertilizer applications. The actual quantity applied shall be recorded, as this is not necessarily the same as the recommendation. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Fertilizer Application LogPA-FR-07 - Issued 2/3/16Quantity Total: Quantity per acre: 5lbs/acre.'
    },
    'CB 4.2.5': {
      question_name: 'Method of application?',
      criteria: [
        'The method and/or equipment used are detailed in the records of all fertilizer applications. In the case the method/equipment is always the same, it is acceptable to record these details only once. If there are various equipment units, these are identified individually. Methods may be e.g. via irrigation or mechanical distribution. Equipment may be e.g. manual or mechanical. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Fertilizer Application LogPA-FR-07Machinery: Sprayer'
    },
    'CB 4.2.6': {
      question_name: 'Operator details?',
      criteria: [
        'The name of the operator who has applied the fertilizer is detailed in the records of all fertilizer applications. If a single individual makes all of the applications, it is acceptable to record the operator details only once.If there is a team of workers performing the fertilization, all of them need to be listed in the records. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Fertilizer Application LogPA-FR-07 Authorization: John Smith'
    },
    'CB 4.3.1': {
      question_name: 'Separately from plant protection products?',
      criteria: [
        'The minimum requirement is to prevent physical cross-contamination between fertilizers (organic and inorganic) and plant protection products by using a physical barrier (wall, sheeting, etc.). If fertilizers that are applied together with plant protection products (i.e. micronutrients or foliar fertilizers) are packed in a closed container, they can be stored with plant protection products.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: '',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No fertilizer storage'
    },
    'CB 4.3.2': {
      question_name: 'In a covered area?',
      criteria: [
        'The covered area is suitable to protect all inorganic fertilizers (e.g. powders, granules or liquids) from atmospheric influences (e.g. sunlight, frost and rain, high temperature). Based on a risk assessment (fertilizer type, weather conditions, storage duration and location), plastic coverage could be acceptable. It is permitted to store lime and gypsum in the field. As long as the storage requirements on the material safety data sheet are complied with, bulk liquid fertilizers can be stored outside in containers'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No fertilizer storage'
    },
    'CB 4.3.3': {
      question_name: 'In a clean area?',
      criteria: [
        'Inorganic fertilizers (e.g. powders, granules or liquids) are stored in an area that is free from waste, does not constitute a breeding place for rodents, and where spillage and leakage may be cleared away.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No fertilizer storage'
    },
    'CB 4.3.4': {
      question_name: 'In a dry area?',
      criteria: [
        'The storage area for all inorganic fertilizers (e.g. powders, granules or liquids) is well ventilated and free from rainwater or heavy condensation. Storage cannot be directly on the soil except for lime/gypsum.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No fertilizer storage'
    },
    'CB 4.3.5': {
      question_name:
        'In an appropriate manner that reduces the risk of contamination of water sources?',
      criteria: [
        'All fertilizers are stored in a manner that poses minimum risk of contamination to water sources. Liquid fertilizer stores/tanks shall be surrounded by an impermeable barrier to contain a capacity to 110% of the volume of the largest container, if there is no applicable legislation.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No fertilizer storage'
    },
    'CB 4.3.6': {
      question_name: 'Not together with harvested products?',
      criteria: ['Fertilizers shall not be stored with harvested products.'],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No fertilizer storage'
    },
    'CB 4.3.7': {
      question_name:
        'Is there an up-to-date fertilizer stock inventory or stock calculation listing incoming fertilizer and records of use available?',
      criteria: [
        'The stock inventory (type and amount of fertilizers stored) shall be updated within a month after there is a movement of the stock (in and out). A stock update can be calculated by registration of supply (invoices or other records of incoming fertilizers) and use (treatments/applications), but there shall be regular checks of the actual content so as to avoid deviations with calculations.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No fertilizer storage'
    },
    'CB 4.4.1': {
      question_name:
        'Does the producer prevent the use of human sewage sludge on the farm?',
      criteria: [
        'No treated or untreated human sewage sludge is used on the farm for the production of GLOBALG.A.P. registered crops. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Human sewage sludge is not used.'
    },
    'CB 4.4.2': {
      question_name:
        'Has a risk assessment been carried out for organic fertilizer, which, prior to application, considers its source, characteristics and intended use?',
      criteria: [
        'Documented evidence is available to demonstrate that a food safety and environmental risk assessment for the use of organic fertilizer has been done, and that at least the following have been considered:•type of organic fertilizer•method of treatment to obtain the organic fertilizer•microbial contamination (plant and human pathogens)•weed/seed content•heavy metal content•timing of application, and placement of organic fertilizer (e.g. direct contact to edible part of crop, ground between crops, etc.).This also applies to substrates from biogas plants.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No organic fertilizer is used.'
    },
    'CB 4.4.3': {
      question_name:
        'Is organic fertilizer stored in an appropriate manner that reduces the risk of contamination of the environment?',
      criteria: [
        'Organic fertilizers shall be stored in a designated area. Appropriate measures, adequate according to the risk assessment in AF 1.2.1., have been taken to prevent the contamination of water sources (e.g. concrete foundation and walls, specially built leak-proof container, etc.) or shall be stored at least 25 meters from water sources.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No organic fertilizer is used.'
    },
    'CB 4.5.1': {
      question_name:
        'Is the content of major nutrients (NPK) of applied fertilizers known?',
      criteria: [
        'Documented evidence/labels detailing major nutrient content (or recognized standard values) is available for all fertilizers used on crops grown under GLOBALG.A.P. within the last 24-month period.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Included in the Fertilizer Application LogPA-FR-07'
    },
    'CB 4.5.2': {
      question_name:
        'Are purchased inorganic fertilizers accompanied by documented evidence of chemical content, which includes heavy metals?',
      criteria: [
        'Documented evidence detailing chemical content, including heavy metals, is available for all inorganic fertilizers used on crops grown under GLOBALG.A.P. within the last 12-month period.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: ''
    },
    'CB 5.1.1': {
      question_name:
        'Are tools used routinely to calculate and optimize the crop irrigation requirements?',
      criteria: [
        'The producer can demonstrate that crop irrigation requirements are calculated based on data (e.g. local agricultural institute data, farm rain gauges, drainage trays for substrate growing, evaporation meters, water tension meters for the percentage of soil moisture content). Where on-farm tools are in place, these should be maintained to ensure that they are effective and in a good state of repair. N/A only for'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'USDA Soil Moisture by Feel and Appearance.'
    },
    'CB 5.2.1': {
      question_name:
        'Has a risk assessment been undertaken that evaluates environmental issues for water management on the farm and has it been reviewed by the management within the previous 12 months?',
      criteria: [
        'There is a documented risk assessment that identifies environmental impacts of the water sources, distribution system and irrigation and crop washing usages. In addition, the risk assessment shall take into consideration the impact of own farming activities on off-farm environments, where information is known to be available. The risk assessment shall be completed, fully implemented and it shall be reviewed and approved annually by the management. See Annex AF.1 (General Guideline for Risk Assessments) and Annex CB.1 (Guideline for On-farm Water Management) for further guidance. No N/A.*Will become Major Must as of 1 July 2017.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Water Management Risk Assessment and Plan Code PA-FR-23 7/19/16. Considers water quantity and quality.'
    },
    'CB 5.2.2': {
      question_name:
        'Is there a water management plan available that identifies water sources and measures to ensure the efficiency of application and which management has approved within the previous 12 months?',
      criteria: [
        'There is a written and implemented action plan, approved by the management within the previous 12 months, which identifies water sources and measures to ensure efficient use and application.The plan shall include one or more of the following: maps (see AF 1.1.1.), photographs, drawings (hand drawings are acceptable) or other means to identify the location of water source(s), permanent fixtures and the flow of the water system (including holding systems, reservoirs or any water captured for re-use).Permanent fixtures, including wells, gates, reservoirs, valves, returns and other above-ground features that make up a complete irrigation system, shall be documented in such a manner as to enable location in the field. The plan shall also assess the need for the maintenance of irrigation equipment. Training and/or retraining of personnel responsible for the oversight or performance duties shall be provided. Short and long-term plans for improvement, with timescales where deficiencies exist, shall be included. This can either be an individual plan or a regional activity that the farm may be participating in or is covered by such activities.*Will become Major Must as of 1 July 2017'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Water Management Risk Assessment and Plan Code PA-FR-23 7/19/16. Water lines are indicated on site map.'
    },
    'CB 5.2.3': {
      question_name:
        'Are records for crop irrigation/fertigation water usage and for the previous individual crop cycle/s with total application volumes maintained?',
      criteria: [
        'The producer shall keep records of the usage of crop irrigation/fertigation water that include the date, cycle duration, actual or estimated flow rate, and the volume (per water meter or per irrigation unit) updated on a monthly basis, based on the water management plan and an annual total. This can also be the hours of systems operating on a timed flow basis.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Irrigation usage records were available. Flow meter recorded.'
    },
    'CB 5.3.1': {
      question_name:
        'Is the use of treated sewage water in pre-harvest activities justified according to a risk assessment?',
      criteria: [
        'Untreated sewage is not used for irrigation/fertigation or other pre-harvest activities.Where treated sewage water or reclaimed water is used, water quality shall comply with the WHO published Guidelines for the Safe Use of Wastewater and Excreta in Agriculture and Aquaculture 2006. Also, when there is reason to believe that the water may be coming from a possibly polluted source (i.e. because of a village upstream, etc.) the farmer shall demonstrate through analysis that the water complies with the WHO guideline requirements or the local legislation for irrigation water. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Untreated sewage water is not used for crops.'
    },
    'CB 5.3.2': {
      question_name:
        'Has a risk assessment on physical and chemical pollution of water used on pre-harvest activities (e.g. irrigation/fertigation, washings, spraying) been completed and has it been reviewed by the management within the last 12 months?',
      criteria: [
        'A risk assessment that takes into consideration, at a minimum, the following shall be performed and documented:- Identification of the water sources and their historical testing results (if applicable).- Method(s) of application (see CB Annex 1 for examples).- Timing of water use (during crop growth stage).- Contact of water with the crop.- Characteristics of the crop and the growth stage.- Purity of the water used for PPP applications. PPP must be mixed in water whose quality does not compromise the effectiveness of the application. Any dissolved soil, organic matter or minerals in the water can neutralize the chemicals. For guidance, producers must obtain the required water standards from the product label, the literature provided by the chemical manufacturers, or seek advice from a qualified agronomist.The risk assessment shall be reviewed by the management every year and updated any time there is a change made to the system or a situation occurs that could introduce an opportunity to contaminate the system. The risk assessment shall address potential physical (e.g. excessive sediment load, rubbish, plastic bags, bottles) and chemical hazards and hazard control procedures for the water distribution system.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Water SOP PA-PO-01 Issued 2/11/16Activities outlined includes inspection of the source and prevention methods for chemical contamination. Water Source Quality Risk Assessment Code PA-FR-14'
    },
    'CB 5.3.3': {
      question_name:
        'Is water used on pre-harvest activities analyzed at a frequency in line with the risk assessment (CB 5.3.2) taking into account current sector specific standards?',
      criteria: [
        'Water testing shall be part of the water management plan as directed by the water risk assessment and current sector specific standards or relevant regulations for the crops being grown. There shall be a written procedure for water testing during the production and harvest season, which includes frequency of sampling, who is taking the samples, where the sample is taken, how the sample is collected, the type of test, and the acceptance criteria. NA for sub-scope Flowers and Ornamentals.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Microbiological sampling included in theWater SOPPA-PO-01 Issued 2/11/16Water tests conducted on 5/26/16. Testing for Total Coliform and E. Coli. Tested before and after chlorination. After chlorination: Total Coliform 1 MPN/ 100 mls. E Coli <1 MPN/ 100 mL'
    },
    'CB 5.3.4': {
      question_name:
        'According to the risk assessment in CB 5.3.2 and current sector specific standards, does the laboratory analysis consider chemical and physical contamination, and is the laboratory accredited against ISO17025 or by competent national authorities for testing water?',
      criteria: [
        'If according to the risk assessment and current sector specific standards there is a risk of contamination, the laboratory analysis provides a record of the relevant identified chemical and physical contaminants.Analysis results from an appropriate laboratory accredited against ISO 17025 or equivalent standard, or laboratories approved for water testing by the local competent authorities are available. NA for sub-scope Flowers and Ornamentals.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Waterlab Corp. NELAP Recognized. Cert. # OR10001-108. Exp. 4/10/17'
    },
    'CB 5.3.5': {
      question_name:
        'Are corrective actions taken based on adverse results from the risk assessment before the next harvest cycle?',
      criteria: [
        'Where required, corrective actions and documentation are available as part of the management plan as identified in the water risk assessment and current sector specific standards.NA for sub-scope Flowers and Ornamentals.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'NA. No adverse results detected. Water used for irrigation is chlorinated.'
    },
    'CB 5.4.1': {
      question_name:
        'Where legally required, are there valid permits/licenses available for all farm water extraction, water storage infrastructure, on-farm usage and, where appropriate, any subsequent water discharge?',
      criteria: [
        'There are valid permits/licenses available issued by the competent authority for all farm water extraction; water storage infrastructure; all on-farm water usage including but not restricted to irrigation, product washing or flotation processes; and where legally required, for water discharge into river courses or other environmentally sensitive areas. These permits/licenses shall be available for inspection and have valid dates.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'TVID(Irrigation District). Water is abstracted from pipelines brought from lake. Water used from April to October. Other months water is shut off.'
    },
    'CB 5.4.2': {
      question_name:
        'Where the water permits/licenses indicate specific restrictions, do the water usage and discharge records confirm that the management has complied with these?',
      criteria: [
        'It is not unusual for specific conditions to be set in the permits/licenses, such as hourly, daily, weekly, monthly or yearly extraction volumes or usage rates. Records shall be maintained and available to demonstrate that these conditions are being met.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'TVID closes access to water after October and up until April.'
    },
    'CB 5.5.1': {
      question_name:
        'Are water storage facilities present and well maintained to take advantage of periods of maximum water availability?',
      criteria: [
        'Where the farm is located in areas of seasonal water availability, there are water storage facilities for water use during periods when water availability is low. Where required, they are legally authorized, in a good state of repair, and appropriately fenced/secured to prevent accidents.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No water storage facilities.'
    },
    'CB 6.1': {
      question_name:
        'Has assistance with the implementation of IPM systems been obtained through training or advice?',
      criteria: [
        'Where an external adviser has provided assistance, training and technical competence shall be demonstrated via official qualifications, specific training courses, etc., unless this person has been employed for that purpose by a competent organization (e.g. official advisory services). Where the technically responsible person is the producer, experience shall be complemented by technical knowledge (e.g. access to IPM technical literature, specific training course attendance, etc.) and/or the use of tools (software, on-farm detection methods, etc.).'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'John Smith- Pesticide Consultant. Lic.. # AG-L0093411PC Exp. 12/31/16. and Peerbolt Crop Management (Scouting)'
    },
    'CB 6.2': {
      question_name: 'Prevention?',
      criteria: [
        'The producer shall show evidence of implementing at least two activities per registered crop that include the adoption of production practices that could reduce the incidence and intensity of pest attacks, and thereby reducing the need for intervention.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Preventative Techniques (PA-FR-19 Issued 2/17/16) include a wide variety of potential practices to prevent weeds, insects, disease, and pests. Peerbolt Crop Management provides full services for IPM. Weekly reports indicates pest activity as well as monitoring and intervention methods.'
    },
    'CB 6.3': {
      question_name: 'Observation and Monitoring?',
      criteria: [
        'The producer shall show evidence of a) implementing at least two activities per registered crop that will determine when and to what extent pests and their natural enemies are present, and b) using this information to plan what pest management techniques are required.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Monitoring and Observation Techniques (PA-FR-20 Issued 1/20/16) Pest, population, management plan, and comments.'
    },
    'CB 6.4': {
      question_name: 'Intervention?',
      criteria: [
        'The producer shall show evidence that in situations where pest attacks adversely affect the economic value of a crop, intervention with specific pest control methods will take place. Where possible, non-chemical approaches shall be considered. Not applicable when the producer did not need to intervene.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Intervention Techniques (PA-FR-21 Issued 2/17/16) include a wide variety of potential non-chemical approaches to reduce weeds, insects, disease, and pests.'
    },
    'CB 6.5': {
      question_name:
        'Have anti-resistance recommendations, either on the label or other sources, been followed to maintain the effectiveness of available plant protection products?',
      criteria: [
        'When the level of a pest, disease or weed requires repeated controls in the crops, there is evidence that anti-resistance recommendations (where available) are followed.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Anti-resistance labels are followed.'
    },
    'CB 7.1.1': {
      question_name:
        'Is a current list kept of plant protection products that are authorized in the country of production for use on crops being grown?',
      criteria: [
        'A list is available for the commercial brand names of plant protection products (including their active ingredient composition or beneficial organisms) that are authorized on crops being, or which have been, grown on the farm under GLOBALG.A.P. within the last 12 months.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Instructions are noted for identifying registered products through Agrian.'
    },
    'CB 7.1.2': {
      question_name:
        'Does the producer only use plant protection products that are currently authorized in the country of use for the target crop (i.e. where such an official registration scheme exists)?',
      criteria: [
        'All the plant protection products applied are officially and currently authorized or permitted by the appropriate governmental organization in the country of application. Where no official registration scheme exists, refer to the GLOBALG.A.P. Guideline (Annex CB 3) on this subject as well as the FAO International Code of Conduct on the Distribution and Use of Pesticides. Refer also to Annex CB 3 for cases where the producer takes part in legal field trials for final approval of PPPs by the local government. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Instructions are noted for identifying registered products through Agrian.'
    },
    'CB 7.1.3': {
      question_name:
        'Is the plant protection product that has been applied appropriate for the target as recommended on the product label?',
      criteria: [
        'All the plant protection products applied to the crop are suitable and can be justified (according to label recommendations or official registration body publication) for the pest, disease, weed or target of the plant protection product intervention. If the producer uses an off-label PPP, there shall be evidence of official approval for use of that PPP on that crop in that country. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Instructions are noted for identifying registered products through Agrian.'
    },
    'CB 7.1.4': {
      question_name: 'Are invoices of plant protection products kept?',
      criteria: [
        'Invoices or packing slips of all plant protection products used and/or stored shall be kept for record keeping and available at the time of the external inspection. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Invoices were available.'
    },
    'CB 7.2.1': {
      question_name:
        'Are the persons selecting the plant protection products competent to make that choice?',
      criteria: [
        'Where the plant protection product records show that the technically responsible person making the choice of the plant protection products is a qualified adviser, technical competence shall be demonstrated via official qualifications or specific training course attendance certificates. Fax and e-mails from advisers, governments, etc. are permissible. Where the plant protection product records show that the technically responsible person making the choice of plant protection products is the producer, experience shall be complemented by technical knowledge that can be demonstrated via technical documentation (e.g. product technical literature, specific training course attendance, etc.).'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'John Smith- Pesticide Consultant. Lic.. # AG-L0093411PC Exp. 12/31/16.'
    },
    'CB 7.3.1': {
      question_name:
        'Are records of all plant protection product applications kept and do they include the following minimum criteria:- Crop name and/or variety- Application location- Date and end time of application- Product trade name and active ingredient- Pre-harvest interval',
      criteria: [
        'All plant protection product application records shall specify: - The crop and/or variety treated. No N/A.- The geographical area, the name or reference of the farm, and the field, orchard or greenhouse where the crop is located. No N/A.- The exact dates (day/month/year) and end time of the application. The actual date (end date, if applied more than one day) of application shall be recorded. Producers need not record end times, but in these cases it shall be considered that application was done at the end of the day recorded. This information shall be used to crosscheck compliance with the pre-harvest intervals. No N/A.- The complete trade name (including formulation) and active ingredient or beneficial organism with scientific name. The active ingredient shall be recorded or it shall be possible to connect the trade name information to the active ingredient. No N/A.- The pre-harvest interval has been recorded for all plant protection product applications where a pre-harvest interval is stated on the product label or, if not on label, as stated by an official source. No N/A unless Flowers and Ornamentals Certification.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Pesticide Application PA-FR-08 Issued 2/3/15Include columns for crop, start and end time, ranch and block, commercial name and active ingredient, and the Pre-harvest interval.Use reports are also noted in Agrian.Crop Name: BlueberriesLocation: All Block Date: 7/24/16 End Time: 11:30 amProduct Name: Malathion ActiveL MalathionPHI: 1 day'
    },
    'CB 7.3.2': {
      question_name: 'Operator?',
      criteria: [
        'Full name and/or signature of the responsible operator/s applying the plant protection products shall be recorded. For electronic software systems, measures shall be in place to ensure authenticity of records. If a single individual makes all the applications, it is acceptable to record the operator details only once. If there is a team of workers doing the application, all of them need to be listed in the records. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Pesticide Application PA-FR-08 Issued 2/3/15 Example Applicator: Jose Montano'
    },
    'CB 7.3.3': {
      question_name: 'Justification for application?',
      criteria: [
        'The name of the pest(s), disease(s) and/or weed(s) treated is documented in all plant protection product application records. If common names are used, they shall correspond to the names stated on the label. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Pesticide Application PA-FR-08 Issued 2/3/15 Example Target Pest: SWD'
    },
    'CB 7.3.4': {
      question_name: 'Technical authorization for application?',
      criteria: [
        'The technically responsible person making the decision on the use and the doses of the plant protection product(s) being applied has been identified in the records. If a single individual authorizes all the applications, it is acceptable to record this person details only once. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Pesticide Application PA-FR-08 Issued 2/3/15 Example Technical Approval: John R Davis- Pesticide Consultant.'
    },
    'CB 7.3.5': {
      question_name: 'Product quantity applied?',
      criteria: [
        'All plant protection product application records specify the amount of product to be applied in weight or volume or the total quantity of water (or other carrier medium) and dose in g/l or internationally recognized measures for the plant protection product. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Pesticide Application PA-FR-08 Issued 2/3/15 Example Total dose: 75 acres totalRate/acre:16 oz./acre'
    },
    'CB 7.3.6': {
      question_name: 'Application machinery used?',
      criteria: [
        'The application machinery type (e.g. knapsack, high volume, U.L.V., via the irrigation system, dusting, fogger, aerial, or another method) for all the plant protection products applied (if there are various units, these are identified individually) is detailed in all plant protection product application records. If it is always the same unit of application machinery (e.g. only 1 boom sprayer), it is acceptable to record the details only once. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Pesticide Application PA-FR-08 Issued 2/3/15 Example Machinery used: 500 Gallon Sprayer'
    },
    'CB 7.3.7': {
      question_name: 'Weather conditions at time of application?',
      criteria: [
        'Local weather conditions (e.g. wind, sunny/covered and humidity) affecting effectiveness of treatment or drift to neighboring crops shall be recorded for all PPP applications. This may be in the form of pictograms with tick boxes, text information, or another viable system on the record. N/A for covered crops.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Pesticide Application PA-FR-08 Issued 2/3/15 Example Weather conditions: 60-65 Degree 0 mph'
    },
    'CB 7.3.8': {
      question_name:
        'Does the producer take active measures to prevent pesticide drift to neighboring plots?',
      criteria: [
        'The producer shall take active measures to avoid the risk of pesticide drift from own plots to neighboring production areas. This may include, but is not limited to, knowledge of what the neighbors are growing, maintenance of spray equipment, etc.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Spray early in the morning, avoid anything spraying above 5 mph.'
    },
    'CB 7.3.9': {
      question_name:
        'Does the producer take active measures to prevent pesticide drift from neighboring plots?',
      criteria: [
        'The producer shall take active measures to avoid the risk of pesticide drift from adjacent plots e.g. by making agreements and organizing communication with producers from neighboring plots in order to eliminate the risk for undesired pesticide drift, by planting vegetative buffers at the edges of cropped fields, and by increasing pesticide sampling on such fields. N/A if not identified as risk'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'NA. Not identified as a risk. Organic growers surrounding sites.'
    },
    'CB 7.4.1': {
      question_name:
        'Have the registered pre-harvest intervals been complied with?',
      criteria: [
        'The producer shall demonstrate that all pre-harvest intervals have been complied with for plant protection products applied to the crops, through the use of clear records such as plant protection product application records and crop harvest dates. Specifically in continuous harvesting situations, there are systems in place in the field, orchard or greenhouse (e.g. warning signs, time of application etc.) to ensure compliance with all pre-harvest intervals. Refer to CB 7.6.4. No N/A, unless Flowers and Ornamentals production.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Application Date: 7/24/16 5:00 amHarvest Date:7/25/16 6:30 amPHI 1 Day (Malathion)Harvest on first block sprayed. PHI Observed.'
    },
    'CB 7.5.1': {
      question_name:
        'Is surplus application mix or tank washings disposed of in a way that does not compromise food safety and the environment?',
      criteria: [
        'Applying surplus spray and tank washings to the crop is a first priority under the condition that the overall label dose rate is not exceeded. Surplus mix or tank washings shall be disposed of in a manner that does compromise neither food safety nor the environment. Records are kept. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Closely calculate mix and any excess is diluted and emptied into designated mix area.'
    },
    'CB 7.6.1': {
      question_name:
        'Can the producer demonstrate that information regarding the Maximum Residue Levels (MRLs) of the country(ies) of destination (i.e. market(s) in which the producer intends to trade) is available?',
      criteria: [
        'The producer or the producer customer shall have available a list of current applicable MRLs for all market(s) in which produce is intended to be traded (domestic and/or international). The MRLs shall be identified by either demonstrating communication with clients confirming the intended market(s), or by selecting the specific country(ies) (or group of countries) in which produce is intending to be traded, and presenting evidence of compliance with a residue screening system that meets the current applicable MRLs of that country. Where a group of countries is targeted together for trading, the residue screening system shall meet the strictest current applicable MRLs in the group. Refer to Annex CB. 4 Residue Analysis.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'MRL data was provided.'
    },
    'CB 7.6.2': {
      question_name:
        'Has action been taken to meet the MRLs of the market in which the producer is intending to trade the produce?',
      criteria: [
        'Where the MRLs of the market in which the producer is intending to trade the produce are stricter than those of the country of production, the producer or the producer customer shall demonstrate that during the production cycle these MRLs have been taken into account (i.e. modification where necessary of plant protection product application regime and/or use of produce residue testing results).'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Additional chemical tracking system in place for monitoring chemical applications in regards to MRL for export destinations.'
    },
    'CB 7.6.3': {
      question_name:
        'Has the producer completed a risk assessment covering all registered crops to determine if the products will be compliant with the MRLs in the country of destination?',
      criteria: [
        'The risk assessment shall cover all registered crops and evaluate the PPP use and the potential risk of MRL exceedance. Risk assessments normally conclude that there is a need to undertake residue analysis and identify the number of analyses, when and where to take the samples, and the type of analysis according to Annex CB 5 Maximum Residue Limit Exceedance Risk Assessment.A risk assessment that concludes that there is no need to undertake residue analysis shall have identified that there is:- A track history of 4 or more years of analytical verification without detecting incidences (e.g. exceedances, use of non-authorized PPPs, etc.); and- No or minimal use of PPPs; and- No use of PPP close to harvesting (spraying to harvest interval is much bigger than the PPP pre-harvest interval); and- A risk assessment validated by an independent third party (e.g. CB inspector, expert, etc.) or the customer. Exceptions to these conditions could be those crops where there is no use of PPPs and the environment is very controlled, and for these reasons the industry does not normally undertake PPP residue analysis (mushrooms could be an example).'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Risk Assessment - Exceeding MRLPA-DC-04 Issued 2/17/16Considers various Field and post farm gate risks and the related control measures.'
    },
    'CB 7.6.4': {
      question_name:
        'Is there evidence of residue tests, based on the results of the risk assessment?',
      criteria: [
        'Based on the outcome of the risk assessment, current documented evidence or records shall be available of plant protection product residue analysis results for the GLOBALG.A.P. registered product crops, or of participation in a plant protection product residue monitoring system that is traceable to the farm and compliant with the minimum requirements set in Annex CB 5. When residue tests are required as a result of the risk assessment, the criteria relating to sampling procedures, accredited labs, etc., shall be followed. Analysis results have to be traceable back to the specific producer and production site where the sample comes from.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Residue tests were conducted on 7/19/16 by Driscolls at AGQ.. One exceedance was found for Malathion for Taiwan. Residue test also conducted by Oregon Berry Packing at Synergistic Laboratory.'
    },
    'CB 7.6.5': {
      question_name: 'Correct sampling procedures are followed?',
      criteria: [
        'Documented evidence exists demonstrating compliance with applicable sampling procedures. See Annex CB. 4 Residue Analysis.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Fruit Sampling for Pesticides Residues GI-IT-08Procedure for collecting samples was provided. Procedure requires compliance with GI-FR-12 Pesticides Samples Chain of Custody.'
    },
    'CB 7.6.6': {
      question_name:
        'The laboratory used for residue testing is accredited by a competent national authority to ISO 17025 or equivalent standard?',
      criteria: [
        'There is clear documented evidence (on letterhead, copies of accreditations, etc.) that the laboratories used for plant protection product residue analysis have been accredited, or are in the process of accreditation to the applicable scope by a competent national authority to ISO 17025 or an equivalent standard. In all cases, the laboratories shall show evidence of participation in proficiency tests (e.g. FAPAS must be available). See Annex CB. 4 Residue Analysis.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'AGQ ISO Certificates'
    },
    'CB 7.6.7': {
      question_name:
        'An action plan is in place in the event of an MRL is exceeded?',
      criteria: [
        'There is a clear documented procedure of the remedial steps and actions (this shall include communication to customers, product tracking exercise, etc.) to be taken where a plant protection product residue analysis indicates an MRL (either of the country of production or the countries in which the harvested product is intended to be traded, if different) is exceeded. See Annex CB. 4 Residue Analysis. This may be part of the recall/withdrawal procedure required by AF. 9.1.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Risk Assessment - Exceeding MRLPA-DC-04 Issued 2/17/16Investigating Pesticide IssuesGI-DC-01 Issued 3/4/16Procedure includes step by step guide on how to investigate the issue as well as the need to notify relevant parties.'
    },
    'CB 7.7.1': {
      question_name:
        'Are plant protection products stored in accordance with local regulations in a secure place with sufficient facilities for measuring and mixing them, and are they kept in their original package?',
      criteria: [
        'The plant protection product storage facilities shall: - Comply with all the appropriate current national, regional and local legislation and regulations.- Be kept secure under lock and key. No N/A.- Have measuring equipment whose graduation for containers and calibration verification for scales been verified annually by the producer to assure accuracy of mixtures, and are equipped with utensils (e.g. buckets, water supply point, etc.), and they are kept clean for the safe and efficient handling of all plant protection products that can be applied. This also applies to the filling/mixing area if this is different. No N/A.- Contain the plant protection products in their original containers and packs. In the case of breakage only, the new package shall contain all the information of the original label. Refer to CB. 7.9.1 No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Plant protection products are stored accordingly.'
    },
    'CB 7.7.2': {
      question_name: 'Sound?',
      criteria: [
        'The plant protection product storage facilities are built in a manner that is structurally sound and robust. Storage capacity shall be appropriate for the highest amount of PPPs that need to be stored during the PPP application season, and the PPPs are stored in a way that is not dangerous for the workers and does not create a risk of cross-contamination between them or with other products. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Well built storage shed.'
    },
    'CB 7.7.3': {
      question_name: 'Appropriate to the temperature conditions?',
      criteria: [
        'The plant protection products are stored according to label storage requirements. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Ambient temperature conditions.'
    },
    'CB 7.7.4': {
      question_name: 'Well ventilated (in the case of walk-in storage)?',
      criteria: [
        'The plant protection product storage facilities have sufficient and constant ventilation of fresh air to avoid a build-up of harmful vapors. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'No ventilation was available in pesticide storage. / CORRECTED 8/17/16. Photographic evidence was submitted of ventilation added to the pesticide storage room.'
    },
    'CB 7.7.5': {
      question_name: 'Well lit?',
      criteria: [
        'The plant protection product storage facilities have or are located in areas with sufficient illumination by natural or artificial lighting to ensure that all product labels can be easily read while on the shelves. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Electricity was available.'
    },
    'CB 7.7.6': {
      question_name: 'Located away from other materials?',
      criteria: [
        'The minimum requirement is to prevent cross contamination between plant protection products and other surfaces or materials that may enter into contact with the edible part of the crop by the use of a physical barrier (wall, sheeting, etc.). No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Located away from products.'
    },
    'CB 7.7.7': {
      question_name:
        'Is all plant protection product storage shelving made of non-absorbent material?',
      criteria: [
        'The plant protection product storage facilities are equipped with shelving that is not absorbent in case of spillage (e.g. metal, rigid plastic, or covered with impermeable liner, etc.).'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Wooden shelving was used. However it was well painted and all containers were placed in plastic totes.'
    },
    'CB 7.7.8': {
      question_name:
        'Is the plant protection product storage facility able to retain spillage?',
      criteria: [
        'The plant protection product storage facilities have retaining tanks or products are bunded according to 110% of the volume of the largest container of stored liquid, to ensure that there cannot be any leakage, seepage or contamination to the exterior of the facility. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Plastic totes were used for spillage.'
    },
    'CB 7.7.9': {
      question_name: 'Are there facilities to deal with spillage?',
      criteria: [
        'The plant protection product storage facilities and all designated fixed filling/mixing areas are equipped with a container of absorbent inert material such as sand, floor brush and dustpan and plastic bags that must be in a fixed location to be used exclusively in case of spillage of plant protection products. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Spill kit was available.'
    },
    'CB 7.7.10': {
      question_name:
        'Are keys and access to the plant protection product storage facility limited to workers with formal training in the handling of plant protection products?',
      criteria: [
        'The plant protection product storage facilities are kept locked and physical access is only granted in the presence of persons who can demonstrate formal training in the safe handling and use of plant protection products. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Kept under lock and key.'
    },
    'CB 7.7.11': {
      question_name:
        'Are plant protection products approved for use on the crops registered for GLOBALG.A.P. Certification stored separately within the storage facility from plant protection products used for other purposes?',
      criteria: [
        'Plant protection products used for purposes other than for registered and/or certified crops (i.e. use in garden etc.) are clearly identified and stored separately in the plant protection product store.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Approved for used.'
    },
    'CB 7.7.12': {
      question_name: 'Are liquids not stored on shelves above powders?',
      criteria: [
        'All the plant protection products that are liquid formulations are stored on shelving that is never above those products that are powder or granular formulations. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Powders above liquids.'
    },
    'CB 7.7.13': {
      question_name:
        'Is there an up-to-date plant protection product stock inventory or calculation of stock with incoming PPPs and records of use available?',
      criteria: [
        'The stock inventory (type and amount of PPPs stored–number of units, e.g. bottles, is allowed) shall be updated within a month after there is a movement of the stock (in and out). The stock update can be calculated by registration of supply (invoices or other records of incoming PPPs) and use (treatments/applications), but there shall be regular checks of the actual content to avoid deviations with calculations.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Chemical Product InventoryPA-FR-10Last Entry on 5/28/16. Sections for Fungicides, insecticide and herbicides.'
    },
    'CB 7.7.14': {
      question_name:
        'Is the accident procedure visible and accessible within 10 meters of the plant protection product/chemical storage facilities?',
      criteria: [
        'An accident procedure containing all information detailed in AF 4.3.1 and including emergency contact telephone numbers shall visually display the basic steps of primary accident care and be accessible by all persons within 10 meters of the plant protection product/chemical storage facilities and designated mixing areas. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Accident procedures and emergency contacts were posted.'
    },
    'CB 7.7.15': {
      question_name:
        'Are there facilities to deal with accidental operator contamination?',
      criteria: [
        'All plant protection product/chemical storage facilities and all filling/mixing areas present on the farm have eye washing amenities, a source of clean water at a distance no farther than 10 meters, and a first aid kit containing the relevant aid material (e.g. a pesticide first aid kit might need aid material for corrosive chemicals or alkaline liquid in case of swallowing, and might not need bandages and splints), all of which are clearly and permanently marked via signage. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Chemical or pesticide exposure kit was available. Emergency eye was available in bathroom located in shop area.'
    },
    'CB 7.8.1': {
      question_name:
        'Does the producer offer all workers who have contact with plant protection products the possibility to be submitted to annual health checks or with a frequency according to a risk assessment that considers their exposure and toxicity of products used?',
      criteria: [
        'The producers provides all workers who are in contact with plant protection products the option of being voluntarily submitted to health checks annually or according to health and safety risk assessment (see AF 4.1.1). These health checks shall comply with national, regional or local codes of practice, and use of results shall respect the legality of disclosure of personal data.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Julion Montano is a pesticide applicator who has been offered an annual health check.'
    },
    'CB 7.8.2': {
      question_name:
        'Are there procedures dealing with re-entry times on the farm?',
      criteria: [
        'There are clear documented procedures based on the label instructions that regulate all the re-entry intervals for plant protection products applied to the crops. Special attention should be paid to workers at the greatest risk, i.e. pregnant/lactating workers, and the elderly. Where no re-entry information is available on the label, there are no specific minimum intervals, but the spray must have dried on the plants before workers re-enter the growing area.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Re-entry interval (REI) procedures document was provided. Procedures require that employees observe label guidelines. Signs are to be posted as required by label and entry is restricted until REI has expired. If workers are required to enter area before REI expiration, workers must wear PPE as required by label.'
    },
    'CB 7.8.3': {
      question_name:
        'If concentrate plant protection products are transported on and between farms, are they transported in a safe and secure manner?',
      criteria: [
        'All transport of PPPs shall be in compliance with all applicable legislation. When legislation does not exist, the producer shall in any case guarantee that the PPPs are transported in a way that does not pose a risk to the health of the worker(s) transporting them.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'All mixing is done adjacent to pesticide storage area.'
    },
    'CB 7.8.4': {
      question_name:
        'When mixing plant protection products, are the correct handling and filling procedures followed as stated on the label?',
      criteria: [
        'Facilities, including appropriate measuring equipment, shall be adequate for mixing plant protection products, so that the correct handling and filling procedures, as stated on the label, can be followed. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Mix according to label.'
    },
    'CB 7.9.1': {
      question_name:
        'Are empty containers rinsed either via the use of an integrated pressure-rinsing device on the application equipment or at least three times with water before storage and disposal, and is the rinsate from empty containers returned to the application equipment tank or disposed of in accordance with CB 7.5.1?',
      criteria: [
        'Pressure-rinsing equipment for plant protection product containers shall be installed on the plant protection product application machinery or there shall be clear written instructions to rinse each container at least 3 times prior to its disposal. Either via the use of a container-handling device or according to a written procedure for the application equipment operators, the rinsate from the empty plant protection product containers shall always be put back into the application equipment tank when mixing, or disposed of in a manner that does compromise neither food safety nor the environment. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Empty containers are triple rinsed.'
    },
    'CB 7.9.2': {
      question_name:
        'Is re-use of empty plant protection product containers for purposes other than containing and transporting the identical product being avoided?',
      criteria: [
        'There is evidence that empty plant protection product containers have not been or currently are not being re-used for anything other than containing and transporting identical product as stated on the original label. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'No issues were observed.'
    },
    'CB 7.9.3': {
      question_name:
        'Are empty containers kept secure until disposal is possible?',
      criteria: [
        'There is a designated secure store point for all empty plant protection product containers prior to disposal that is isolated from the crop and packaging materials (i.e. permanently marked via signage and locked, with physically restricted access for persons and fauna).'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Kept in a locked area next to pesticide storage.'
    },
    'CB 7.9.4': {
      question_name:
        'Does disposal of empty plant protection product containers occur in a manner that avoids exposure to humans and contamination of the environment?',
      criteria: [
        'Producers shall dispose of empty plant protection product containers using a secure storage point, a safe handling system prior to the disposal, and a disposal method that complies with applicable legislation and avoids exposure to people and the contamination of the environment (watercourses, flora and fauna). No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Empty containers are taken to Wilcow Recycling. Records of last two deliveries was available.'
    },
    'CB 7.9.5': {
      question_name:
        'Are official collection and disposal systems used when available, and in that case are the empty containers adequately stored, labeled, and handled according to the rules of a collection system?',
      criteria: [
        'Where official collection and disposal systems exist, there are records of participation by the producer. All the empty plant protection product containers, once emptied, shall be adequately stored, labeled, handled, and disposed of according to the requirements of the official collection and disposal schemes, where applicable.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Empty containers are taken to Wilcow Recycling.'
    },
    'CB 7.9.6': {
      question_name:
        'Are all local regulations regarding disposal or destruction of containers observed?',
      criteria: [
        'All the relevant national, regional and local regulations and legislation, if such exist, have been complied with regarding the disposal of empty plant protection product containers.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Empty containers are taken to Wilcow Recycling.'
    },
    'CB 7.10.1': {
      question_name:
        'Are obsolete plant protection products securely maintained and identified and disposed of by authorized or approved channels?',
      criteria: [
        'There are records that indicate that obsolete plant protection products have been disposed of via officially authorized channels. When this is not possible, obsolete plant protection products are securely maintained and identifiable.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No obsolete products were observed.'
    },
    'CB 7.11.1': {
      question_name:
        'Are records available if substances are used on crops and/or soil that are not covered under the section Fertilizer and Plant Protection Products?',
      criteria: [
        'If homemade preparations, plant strengtheners, soil conditioners, or any other such substances are used on certified crops, records shall be available. These records shall include the name of the substance (e.g. plant from which it derives), the trade name (if purchased product), the field, the date, and the amount. If in the country of production a registration scheme for this substance(s) exists, it has to be approved. Where the substances do not require registration for use in the country of production, the producer shall make sure that the use does not compromise food safety'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No other substances used.'
    },
    'CB 8.1': {
      question_name:
        'Is equipment sensitive to food safety (e.g. plant protection product sprayers, irrigation/fertigation equipment, post-harvest product application equipment) maintained in a good state of repair, routinely verified and, where applicable, calibrated at least annually, and are records of measures taken within the previous 12 months available?',
      criteria: [
        'The equipment is kept in a good state of repair with documented evidence of up-to-date maintenance sheets for all repairs, oil changes, etc. undertaken.E.g.:Plant protection product sprayers: See Annex CB.6 for guidance on compliance with visual inspection and functional tests of application equipment. The calibration of the plant protection product application machinery (automatic and non-automatic) has been verified for correct operation within the last 12 months and this is certified or documented either by participation in an official scheme (where it exists) or by having been carried out by a person who can demonstrate their competence.If small handheld measures not individually identifiable are used, then their average capacity has been verified and documented, with all such items in use having been compared to a standard measure at least annually.Irrigation/fertigation equipment: As a minimum, annual maintenance records shall be kept for all methods of irrigation/fertigation machinery/techniques used.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Calibration of Equipment Used for the Application of Pesticides PA‐FR‐09Calibration log was provided.1/18/16 500 Gal Sprayer and 100 Gal Sprayer.'
    },
    'CB 8.2': {
      question_name:
        'Is equipment sensitive to the environment and other equipment used on the farming activities (e.g. fertilizer spreaders, equipment used for weighing and temperature control) routinely verified and, where applicable, calibrated at least annually?',
      criteria: [
        'The equipment used is kept in a good state of repair with documented evidence of up-to-date maintenance sheets for all repairs, oil changes, etc. undertaken.E.g.: Fertilizer spreader: There shall exist, as a minimum, records stating that the verification of calibration has been carried out by a specialized company, supplier of fertilization equipment or by the technically responsible person of the farm within the last 12 months.If small handheld measures not individually identifiable are used, then their average capacity has been verified and documented, with all such items in use having been compared to a standard measure at least annually.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Calibration of Equipment Used for the Application of Pesticides PA‐FR‐09Calibration log was provided.1/18/16 500 Gal Sprayer and 100 Gal Sprayer.'
    },
    'CB 8.3': {
      question_name:
        'Is the producer involved in an independent calibration-certification scheme, where available?',
      criteria: [
        'The producer involvement in a calibration scheme is documented. In the case the producer uses an official calibration system cycle longer than one year, the producer still requires internal annual verification of the calibration as per CB 8.1.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No third party calibrations.'
    },
    'CB 8.4': {
      question_name:
        'Is the plant protection product equipment stored in such a way as to prevent product contamination?',
      criteria: [
        'The equipment used in the application of plant protection products (e.g. spray tanks, knapsacks) is stored in a secure way that prevents product contamination or other materials that may enter into contact with the edible part of the harvested products.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Sprayers is kept in designated area built to absorb any spillage.'
    },
    'FV 1.1.1': {
      question_name:
        'Does the risk assessment for the farm site carried out as identified in AF 1.2.1. make particular reference to microbial contamination?',
      criteria: [
        'As part of their risk assessment for the farm site (see AF 1.2.1.), producers shall identify the locations of nearby commercial animal operations, composting and potential sources for ingress by domestic and wild animals, and other contamination routes such as floodwater intrusion and dust.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'New Site Risk AssessmentPA-FR-13 Document addresses adjacent land uses history of animal operations, composting, animal activity, flooding, etc.'
    },
    'FV 1.1.2': {
      question_name:
        'Has a management plan that establishes and implements strategies to minimize the risks identified in FV 1.1.1. been developed and implemented?',
      criteria: [
        'A management plan addresses the risks identified in FV 1.1.1 and describes the hazard control procedures that justify that the site in question is suitable for production. This plan shall be appropriate to the products being produced and there shall be evidences of its implementation and effectiveness.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'New Site Risk AssessmentPA-FR-13Corrections section is available if any issues are found on the site risk assessment. Some items (ex. Dust) have mitigation strategies listed.'
    },
    'FV 2.1.1': {
      question_name:
        'Is there a written justification for the use of soil fumigants?',
      criteria: [
        'There is written evidence and justification for the use of soil fumigants including location, date, active ingredient, doses, method of application and operator. The use of Methyl Bromide as a soil fumigant is not permitted.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No soil fumigation.'
    },
    'FV 2.1.2': {
      question_name:
        'Is any pre-planting interval complied with prior to planting?',
      criteria: ['Pre-planting interval shall be recorded.'],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No soil fumigation.'
    },
    'FV 3.1': {
      question_name:
        'Does the producer participate in substrate recycling programs for substrates where available?',
      criteria: [
        'The producer keeps records documenting quantities recycled and dates. Invoices/loading dockets are acceptable. If there is no participation in a recycling program available, it should be justified.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No substrates are used.'
    },
    'FV 3.2': {
      question_name:
        'If chemicals are used to sterilize substrates for reuse, have the location, the date of sterilization, type of chemical, method of sterilization, name of the operator and pre-planting interval been recorded?',
      criteria: [
        'When the substrates are sterilized on the farm, the name or reference of the field, orchard or greenhouse is recorded. If sterilized off farm, then the name and location of the company that sterilizes the substrate are recorded. The following are all correctly recorded: the dates of sterilization (day/month/year), the name and active ingredient, the machinery (e.g. 1000l-tank, etc.), the method (e.g. drenching, fogging, etc.), the operator’s name (i.e. the person who actually applied the chemicals and did the sterilization), and the pre-planting interval.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No substrates are used.'
    },
    'FV 3.3': {
      question_name:
        'If a substrate of natural origin is used, can it be demonstrated that it does not come from designated conservation areas?',
      criteria: [
        'Records exist that attest the source of the substrate of natural origin being used. These records demonstrate that the substrate does not come from designated conservation areas.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No substrates are used.'
    },
    'FV 4.1.1': {
      question_name:
        'Is there evidence of a risk assessment covering the microbiological quality of the water used in all pre-harvest operations?',
      criteria: [
        'A written risk assessment of microbiological quality of the water is conducted. It includes water source, proximity to potential sources of contamination, application timing (growth stage of the crop), application method, and placement of application (harvestable part of the crop, other parts of the crop, ground between crops, etc.).'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Water SOP - PA-PO-01, Issued 2/11/16Includes procedures, and decision tree, and a Water Source Risk Assessment (PA-FR-14).'
    },
    'FV 4.1.2': {
      question_name:
        'Is water used on pre-harvest activities analyzed as part of the risk assessment and at a frequency in line with that risk assessment (FV 4.1.1.) and no less than indicated in Annex FV1?',
      criteria: [
        'GLOBALG.A.P. producers shall comply with the local applicable limits for microbiological contaminants in the water used on pre-harvest activities, and in their absence use the WHO recommendations as a reference for the decision making process for preventive and/or corrective actions (see Annex FV1). Compliance with the applicable thresholds shall be verified through water tests carried out in a frequency as indicated by the decision tree in Annex FV1 (risk assessment).Water testing regime shall reflect the nature and extent of the water system as well as the type of product. Where substantiallly different water sources are used, they shall be considered separately with regard to sampling. Where one water source services multiple systems or farms it may be possible to treat this as the single origin for sampling purposes.Samples from field level shall be taken from places that are more representative of the water source, usually as close to the point of application as possible.*Became Major Must as of 1 July 2016'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Microbiological sampling included in theWater SOPPA-PO-01 Issued 2/11/16Water tests conducted on 5/26/16. Testing for Total Coliform and E. Coli. Tested before and after chlorination. After chlorination: Total Coliform 1 MPN/ 100 mls. E Coli <1 MPN/ 100 mL'
    },
    'FV 4.1.3': {
      question_name:
        'In the case the risk assessment or the water tests require it, has the producer implemented adequate actions to prevent product contamination?',
      criteria: [
        'When the risk assessment based on the water testing indicates risks of product contamination, action shall be required. Possible strategies to reduce the risk of product contamination arising from water use include, but are not limited to:- Treating water before use. - Preventing water coming into contact with the harvestable portion of the crop. - Reducing the vulnerability of the water supply. - Allowing sufficient time between application and harvest to ensure an appropriate decline in pathogen populations.Producers implementing these strategies shall have an adequate and reliable validation process to demonstrate that product contamination is being avoided.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'NA. No specific actions have been taken. Water has been under chlorination for years.'
    },
    'FV 4.1.4': {
      question_name:
        'According to the risk assessment, FV 4.1.1, and current sector specific standards, does the laboratory analysis consider microbiological contamination, and is the laboratory accredited against ISO17025 or by competent national authorities for testing water?',
      criteria: [
        'Analyses are carried out by an appropriate laboratory accredited against ISO 17025 or equivalent standard and capable of performing microbiological analyses, or by laboratories approved for water testing by the local competent authorities. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Waterlab Corp. NELAP Recognized. Cert. # OR10001-108. Exp. 4/10/17'
    },
    'FV 4.2.1': {
      question_name:
        'Does the interval between the application of organic fertilizer and the product harvest not compromise food safety?',
      criteria: [
        'Records show that the interval between use of composted organic fertilizers and harvest does not compromise food safety (see also CB 4.4.2).When raw animal manure is used, it shall be incorporated into the soil:- prior to bud burst (for tree crops),- at least 60 days prior to harvest for all other crops. In the case of leafy greens (also called potherbs, greens, vegetable greens, leafy greens, or salad greens) it cannot be applied after planting even if the growing cycle is longer than 60 days.Refer to FV Annex 1.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'NA. No organic fertilizer is used.'
    },
    'FV 4.3.1': {
      question_name:
        'Is there lack of evidence of excessive animal activity in the crop production area that is a potential food safety risk?',
      criteria: [
        'Appropriate measures shall be taken to reduce possible contamination within the growing area. Example subjects to be considered include: livestock near the field, high concentrations of wildlife in the field, rodents, and domestic animals (own animals, dog walkers, etc.). Where appropriate buffer areas, physical barriers, fences should be used.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Animal Activity DocumentsPA-PO-06 Issued 1/25/16Document discusses personnel responsibilities and actions to be taken to prevent animal intrusion. Decision tree is also included. Inspection of Operation DocumentPA-FR-04 Issued 1/22/15Inspection document requires evidence of animal intrusion to be inspected prior to start of operations.'
    },
    'FV 5.1.1': {
      question_name:
        'Has a hygiene risk assessment been performed for the harvest, pre-farm gate transport process, and post-harvest activities including product handling?',
      criteria: [
        'There is a documented hygiene risk assessment covering physical, chemical and microbiological contaminants, spillage of bodily fluids (e.g. vomiting, bleeding), and human transmissible diseases, customized to the products and processes. It shall cover all harvest and product handling activities carried out by the producer, as well as personnel, personal effects, equipment, clothing, packaging material and product storage (also short-term storage at farm). The risk assessment shall be tailored to the activities of the farm, the crops, and the technical level of the business and be reviewed every time risks change and at least annually. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Hygiene Risk Assessment GI-FR-04 Issued 12/4/15Considers specific biological risks as well as more general chemical and physical risks in two sections: Harvest & Field handling, and Transportation (From field to Cooler). Assessment requires that packaging and packed product be kept off the ground, the need for disposable cleaning products, proper cleaning of transport vehicles, etc.'
    },
    'FV 5.1.2': {
      question_name:
        'Are there documented hygiene procedures and instructions for the harvest and post-harvest processes including product handling (also when they take place directly on the field, orchard or greenhouse) designed to prevent contamination of crop, crop production areas, food contact surfaces and harvested product?',
      criteria: [
        'Based on the risk assessment, there are documented hygiene procedures for the harvesting and post-harvesting processes. Procedures shall include evaluating whether workers are fit to return to work after illness.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Hygiene During the Harvest SOP PA-PO-02The procedures outlines the Responsibilities, Precautions, and Activities which include: Personal Hygiene and Behavior, Cleaning of the Field, Use of Gloves, Worker Health, Training, Utensils, Handing Packaging, Fruit Transport Conditions and Sanitary Facilities.'
    },
    'FV 5.1.3': {
      question_name:
        'Are the hygiene procedures and instructions for the harvest and post-harvest activities, including product handling, implemented?',
      criteria: [
        'The operation shall nominate the farm manager or other competent person as responsible for the implementation of the hygiene procedures by all workers and visitors. When the risk assessment determines that specific clothing (e.g. smocks, aprons, sleeves, gloves, footwear–see Annex FV 1, 5.4.2) shall be used, it shall be cleaned when it becomes soiled to the point of becoming a risk of contamination, and shall be effectively maintained and stored.Visual evidence shows that no violations of the hygiene instructions and procedures occur. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Hygiene procedures were posted and observed being implemented.'
    },
    'FV 5.1.4': {
      question_name:
        'Have workers received specific training in hygiene before harvesting and handling produce?',
      criteria: [
        'There shall be evidence that the workers received specific induction and annual training regarding the hygiene procedures for the harvesting and product handling activities. Workers shall be trained using written (in appropriate languages) and/or pictorial instructions to prevent physical (e.g. snails, stones, insects, knives, fruit residues, watches, mobile phones, etc.), microbiological and chemical contamination of the product during harvesting. Training records and evidence of attendance shall be available'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Training Log GI-FR-07Details the Date, Topic, Materials, Participants, Location and Instructor.'
    },
    'FV 5.1.5': {
      question_name:
        'Are signs that communicate the primary hygiene instructions to workers and visitors, including at least instructions to workers, to wash their hands before returning to work clearly displayed?',
      criteria: [
        'Signs with the main hygiene instructions shall be visibly displayed in the relevant locations and include clear instructions that hands shall be washed before handling produce. Workers handling ready to eat products shall wash their hands prior to start of work, after each visit to a toilet, after handling contaminated material, after smoking or eating, after breaks, prior to returning to work, and at any other time when their hands may have become a source of contamination.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Signage was posted at shop area and on portable restrooms located outside growing area.'
    },
    'FV 5.1.6': {
      question_name:
        'Are smoking, eating, chewing and drinking confined to designated areas segregated from growing areas and products?',
      criteria: [
        'Smoking, eating, chewing and drinking are confined to designated areas away from crops awaiting harvest and are never permitted in the produce handling or storage areas, unless indicated otherwise by the risk assessment. (Drinking water is the exception).'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Hygiene During the Harvest SOP PA-PO-02The procedures outlines the Responsibilities, Precautions, and Activities which include: Personal Hygiene and Behavior, Cleaning of the Field, Use of Gloves, Worker Health, Training, Utensils, Handing Packaging, Fruit Transport Conditions and Sanitary Facilities. Workers have designated eating area outside growing area.'
    },
    'FV 5.2.1': {
      question_name:
        'Do harvest workers who come into direct contact with the crops have access to appropriate hand-washing equipment and make use of it?',
      criteria: [
        'Wash stations shall be available and maintained (hand soap, towels) in a clean and sanitary condition to allow workers to clean their hands. Personnel shall wash their hands prior to start of work; after each visit to a toilet; after handling contaminated material; after smoking, or eating; after breaks; prior to returning to work; and at any other time when their hands may have become a source of contamination. Water used for hand washing shall at all times meet the microbial standard for drinking water. If this is not possible, sanitizer (e.g. alcohol based gel) shall be used after washing hands with soap and water with irrigation water quality.Hand-washing stations shall be provided inside or close to toilet facilities. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Handwashing equipment was available outside all portable restrooms.'
    },
    'FV 5.2.2': {
      question_name:
        'Do harvest workers have access to clean toilets in the vicinity of their work?',
      criteria: [
        'Field sanitation units shall be designed, constructed, and located in a manner that minimizes the potential risk for product contamination and allows direct accessibility for servicing. Fixed or mobile toilets (including pit latrines) are constructed of materials that are easy to clean and they are in a good state of hygiene. Toilets are expected to be in a reasonable proximity (e.g. 500m or 7 minutes) to place of work. Failure point = no or insufficient toilets in reasonable proximity to place of work. Not applicable is only possible when harvest workers don’t come in contact with marketable produce during harvesting (e.g. mechanical harvesting). Toilets shall be appropriately maintained and stocked. (For guidance, see Annex FV 1, 5.4.1)'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Clean toilets were available and located around growing area.'
    },
    'FV 5.2.3': {
      question_name:
        'Do workers handling the product on the field or in a facility have access to clean toilets and hand-washing facilities in the vicinity of their work?',
      criteria: [
        'Hand washing facilities, containing non-perfumed soap, water to clean and disinfect hands, and hand-drying facilities shall be accessible and near to the toilets (as near as possible without the potential for cross-contamination). Workers shall wash their hands prior to start of work; after each visit to a toilet; after using a handkerchief/tissue; after handling contaminated material; after smoking, eating or drinking, after breaks; prior to returning to work; and at any other time when their hands may have become a source of contamination. When handling takes place in a facility, toilets shall be maintained in a good state of hygiene, and shall not open directly onto the produce handling area, unless the door is self-closing.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification: 'Clean toilets and hand-washing facilities were available.'
    },
    'FV 5.2.4': {
      question_name:
        'Are the harvest containers used exclusively for produce and are these containers, the tools used for harvesting and the harvest equipment appropriate for their intended use and cleaned, maintained and able to protect the product from contamination?',
      criteria: [
        'Reusable harvesting containers, harvesting tools (e.g. scissors, knives, pruning shears, etc.) and harvesting equipment (e.g. machinery) are cleaned and maintained. A documented cleaning (and, when indicated by the risk assessment, disinfection) schedule is in place to prevent produce contamination.Produce containers are only used to contain harvested product (i.e. no agricultural chemicals, lubricants, oil, cleaning chemicals, plant or other debris, lunch bags, tools, etc.).'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'No issues were observed. Cleaning buckets are owned by Labor Contractor. Cleaning procedure was available for review. Buckets are on a rotation schedule, where clean buckets are available daily.'
    },
    'FV 5.2.5': {
      question_name: 'Are there suitable changing facilities for the workers?',
      criteria: [
        'The changing facilities should be used to change clothing and protective outer garments as required.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'No specialized protective outer garments required for harvesters.'
    },
    'FV 5.2.6': {
      question_name:
        'Are vehicles used for pre-farm gate transport of harvested produce and any equipment used for loading cleaned and maintained where necessary according to risk?',
      criteria: [
        'Farm vehicles used for loading and pre-farm gate transport of harvested produce are cleaned and maintained so as to prevent produce contamination (e.g. soil, dirt, animal manure, spills, etc.).'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'yes',
        units: 'yes-no-n_a'
      },
      justification:
        'Cleaning Procedure for mechanical harvester was available. Clean, sanitize and rinse. Cleaning Log Code PA-FR-01 50% bleach 50% waterLog for cleaning of Mechanical Harvester. Cleaned before every use. Last Entry 7/25/16'
    },
    'FV 5.3.1': {
      question_name:
        'If ice (or water) is used during any operations relating to harvest or cooling, does it meet the microbial standards for drinking water, and is it handled under sanitary conditions to prevent produce contamination?',
      criteria: [
        'Any ice or water used in relation to harvest or cooling shall meet microbial standards for drinking water and shall be handled under sanitary conditions to prevent produce contamination. The only exception is in the case of cranberry fields that are harvested by flooding, where producers shall at a minimum guarantee that the water is not a source of microbiological contamination.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification: 'No ice or water is used in the berry harvest.'
    },
    'FV 5.4.1': {
      question_name: 'Is harvested produce protected from contamination?',
      criteria: [
        'All harvested produce (regardless stored bulk or packed) shall be protected from contamination.In the case of produce packed and handled directly in the field, it shall all be removed from the field during the day (not stored on the field overnight in open-air conditions), in accordance with the harvest hygiene risk assessment results. Food safety requirements shall be complied with if produce is stored on a short time basis at the farm.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.4.2': {
      question_name:
        'Are all collection/storage/distribution points of packed produce, also those in the field, maintained in clean and hygienic conditions?',
      criteria: [
        'To prevent contamination, all on- and off-farm storage and produce handling facilities and equipment (i.e. process lines and machinery, walls, floors, storage areas, etc.) shall be cleaned and/or maintained according to a documented cleaning and maintenance schedule that includes defined minimum frequency. Records of cleaning and maintenance shall be kept.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.4.3': {
      question_name:
        'Are packing materials appropriate for use, and are they used and stored in clean and hygienic conditions so as to prevent them from becoming a source of contamination?',
      criteria: [
        'Packaging material used shall be appropriate for the food safety of the products packed. To prevent product contamination, packing materials (including re-useable crates) shall be stored in a clean and hygienic area.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.4.4': {
      question_name:
        'Are bits of packaging material and other non-produce waste removed from the field?',
      criteria: [
        'Bits of packaging material and non-produce waste shall be removed from the field.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.4.5': {
      question_name:
        'Are cleaning agents, lubricants, etc. stored to prevent chemical contamination of produce?',
      criteria: [
        'To avoid chemical contamination of produce, cleaning agents, lubricants etc. shall be kept in a designated secure area, away from where produce is packed.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.4.6': {
      question_name:
        'Are cleaning agents, lubricants etc. that may come into contact with produce approved for application in the food industry? Are label instructions followed correctly?',
      criteria: [
        'Documented evidence exists (i.e. specific label mention or technical data sheet) authorizing use for the food industry of cleaning agents, lubricants etc. that may come into contact with produce.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.4.7': {
      question_name:
        'Are all forklifts and other driven transport trolleys clean and well maintained and of a suitable type to avoid contamination through emissions?',
      criteria: [
        'Internal transport should be maintained in a manner to avoid produce contamination, with special attention to fume emissions. Forklifts and other driven transport trolleys should be electric or gas-driven.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.4.8': {
      question_name:
        'Is rejected and contaminated produce not introduced in the supply chain and is waste material effectively controlled in a way that it does not pose a risk of contamination?',
      criteria: [
        'Produce that poses a microbial food safety hazard is not harvested or is culled. Culled produce and waste materials are stored in clearly designated and segregated areas designed to avoid contamination of products. These areas are routinely cleaned and/or disinfected according to the cleaning schedule. Only daily accumulations of rejected produce and waste materials are acceptable.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.4.9': {
      question_name:
        'Are breakage safe lamps and/or lamps with a protective cap used above the sorting, weighing and storage area?',
      criteria: [
        'In case of breakage, light bulbs and fixtures suspended above produce or material used for produce handling are of a safety type or are protected/shielded so as to prevent food contamination.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.4.10': {
      question_name:
        'Are there written procedures for handling glass and clear hard plastic in place?',
      criteria: [
        'Written procedures exist for handling glass and/or clear hard plastic breakages, which could be a source of physical contamination and/or damage the product (e.g. in greenhouses, produce handling, preparation and storage areas).'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.5.1': {
      question_name:
        'Are temperature and humidity controls (where applicable) maintained and documented?',
      criteria: [
        'If packed produce is stored either on-farm or in a packinghouse, temperature and humidity controls (where necessary to comply with quality requirements and also for controlled atmosphere storage) shall be maintained and documented.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.6.1': {
      question_name:
        'Is there a system for monitoring and correcting pest populations in the packing and storing areas?',
      criteria: [
        'Producers shall implement measures to control pest populations in the packing and storing areas appropriate to the farm condition. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.6.2': {
      question_name:
        'Is there visual evidence that the pest monitoring and correcting process are effective?',
      criteria: [
        'A visual assessment shows that the pest monitoring and correcting process are effective. No N/A.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.6.3': {
      question_name:
        'Are detailed records kept of pest control inspections and necessary actions taken?',
      criteria: [
        'Monitoring is scheduled and there are records of pest control inspections and follow-up action plan(s).'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.7.1': {
      question_name:
        'Is the source of water used for final product washing potable or declared suitable by the competent authorities?',
      criteria: [
        'The water has been declared suitable by the competent authorities and/or a water analysis has been carried out at the point of entry into the washing machinery within the last 12 months. The levels of the parameters analyzed are within accepted WHO thresholds or are accepted as safe for the food industry by the competent authorities.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.7.2': {
      question_name:
        'If water is re-circulated for final product washing, has this water been filtered and are pH, concentration and exposure levels to disinfectant routinely monitored?',
      criteria: [
        'Where water is re-circulated for final produce washing, it is filtered and disinfected, and pH, concentration and exposure levels to disinfectant are routinely monitored. Records are maintained. Filtering shall be done using an effective system for solids and suspensions that have a documented routine cleaning schedule according to usage rates and water volume. Where recording of automatic filter backwash events and changes in dosage rates by automated sanitizer injectors may be impossible, a written procedure/policy shall explain the process.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.7.3': {
      question_name:
        'Is the laboratory carrying out the water analysis a suitable one?',
      criteria: [
        'The water analysis for the product washing is undertaken by a laboratory currently accredited to ISO 17025 or its national equivalent or one that can demonstrate via documentation that it is in the process of gaining accreditation.'
      ],

      globalgap_level: 'recom',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.8.1': {
      question_name: 'Are all label instructions observed?',
      criteria: [
        'There are clear procedures and documentation available, (e.g. application records for post-harvest biocides, waxes and plant protection products) that demonstrate compliance with the label instructions for chemicals applied.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.8.2': {
      question_name:
        'Are all the biocides, waxes and plant protection products used for post-harvest protection of the harvested crop officially registered in the country of use?',
      criteria: [
        'All the post-harvest biocides, waxes and plant protection products used on harvested crop are officially registered or permitted by the appropriate governmental organization in the country of application. They are approved for use in the country of application and are approved for use on the harvested crop to which they are applied as indicated on the labels of the biocides, waxes and crop protection products. Where no official registration scheme exists, refer to the GLOBALG.A.P. Guideline (CB Annex 3 PPP Use in Countries that Allow Extrapolation) on this subject and the FAO International Code of Conduct on the Distribution and Use of'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.8.3': {
      question_name:
        'Is an up-to-date list maintained of post-harvest plant protection products that are used, and approved for use, on crops being grown?',
      criteria: [
        'An up-to-date documented list that takes into account any changes in local and national legislation for biocides, waxes and plant protection products is available for the commercial brand names (including any active ingredient composition) that are used as post-harvest plant protection products for produce grown on the farm under GLOBALG.A.P. within the last 12 months. No N/A.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.8.4': {
      question_name:
        'Is the technically responsible person for the application of post-harvest plant protection products able to demonstrate competence and knowledge with regard to the application of biocides, waxes and plant protection products?',
      criteria: [
        'The technically responsible person for the post-harvest biocides, waxes and plant protection products applications can demonstrate a sufficient level of technical competence via nationally recognized certificates or formal training.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.8.5': {
      question_name:
        'Is the source of water used for post-harvest treatments potable or declared suitable by the competent authorities?',
      criteria: [
        'The water has been declared suitable by the competent authorities and/or within the last 12 months a water analysis has been carried out at the point of entry into the washing machinery. The levels of the parameters analyzed are within accepted WHO thresholds or are accepted as safe for the food industry by the competent authorities.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.8.6': {
      question_name:
        'Are the biocides, waxes and plant protection products used for post-harvest treatment stored away from produce and other materials?',
      criteria: [
        'To avoid the chemical contamination of the produce, biocides, waxes and plant protection products etc. are kept in a designated secure area, away from the produce.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.8.7': {
      question_name:
        'Are all records of post-harvest treatments maintained and do they include the minimum criteria listed below? - Identity of harvested crops (i.e. lot or batch of produce); - Location - Application dates - Type of treatment - Product trade name and active ingredient - Product quantity',
      criteria: [
        'The following information is recorded in all records of post-harvest biocide, wax and plant protection product applications: - The lot or batch of harvested crop treated.- The geographical area, the name or reference of the farm, or harvested crop-handling site where the treatment was undertaken. - The exact dates (day/month/year) of the applications. - The type of treatment used for product application (e.g. spraying, drenching, gassing etc.).- The complete trade name (including formulation) and active ingredient or beneficial organism with scientific name. The active ingredient shall be recorded or it shall be possible to connect the trade name information to the active ingredient. - The amount of product applied in weight or volume per liter of water or other carrier medium. No N/A'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.8.8': {
      question_name: 'Name of the operator?',
      criteria: [
        'The name of the operator who has applied the plant protection product to the harvested produce is documented in all records of post-harvest biocide, wax and plant protection product applications.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.8.9': {
      question_name: 'Justification for application?',
      criteria: [
        'The common name of the pest/disease to be treated is documented in all records of post-harvest biocide, wax and plant protection product applications.'
      ],

      globalgap_level: 'minor_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    },
    'FV 5.8.10': {
      question_name:
        'Are all of the post-harvest plant protection product applications also considered under points CB 7.6?',
      criteria: [
        'There is documented evidence to demonstrate that the producer considers all post-harvest biocides and plant protection products applications under Control Point CB 7.6, and acts accordingly.'
      ],

      globalgap_level: 'major_must',
      score: {
        value: 'n_a',
        units: 'yes-no-n_a'
      },
      justification:
        'N/A - Packing and storage areas not included in scope of inspections.'
    }
  }
}
