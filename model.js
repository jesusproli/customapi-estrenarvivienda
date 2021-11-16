module.exports = {

  /**
   * changeStatus
   * @param {*} params 
   * @param {*} callback 
   */
  changeStatus: (params, callback) => {    
    try {
      let proposalId = ''
      const status = prlbu._.get(params, 'status')
      const proposalNumber = prlbu._.get(params, 'uuid')
      
      const tasks = {
        validateIfProposalExist: (callback) => {
          try {
            prlbu.models.Proposal.find({ proposalNumber }, (err, docs) => {
              if (err) return callback(err)
              if (prlbu._.isEmpty(docs)) return callback(`Proposal No. ${proposalNumber} does not exist.`)
              proposalId = prlbu._.get(docs, '[0].id')
              callback()
            })		
          } catch (error) {
            callback('[changeStatus.validateIfProposalExist] ' + error)
          }
        },
        changeStatus: (callback) => {
          try {
            prlbu.models.Proposal.changeStatus({id: proposalId, status}, (err, res) => {
              if (err) return callback(err)
              callback()
            })
          } catch (error) {
            callback('[changeStatus.changeStatus] ' + error)
          }
        }
      }
      prlbu.async.series(tasks, err => {
        if (err) return callback(err)
        callback()
      })
    } catch (error) {
      callback('beforeValidate [ERROR]: ' + error)
    }
	},

  /**
   * beforeValidate
   * @param {*} params 
   * @param {*} callback 
   */
  beforeValidate: (params, callback) => {
    try {
      prlbu.Validator.beforeValidate(prlbu.tableName, params, (err, res) => {
        err ? callback(err) : callback()
      })
    } catch (error) {
      callback('[beforeValidate] ' + error)
    }
  },

  /**
   * beforeDestroy
   * @param {*} params 
   * @param {*} callback 
   */
  beforeDestroy: (params, callback) => {
    try {
      const tasks = {
        validateHasProposal: (callback) => {
          try {
            const uuid = prlbu._.get(params, 'where.uuid')
            const query = { proposalNumber: prlbu._.get(params, 'where.uuid')}
            if (!uuid) return callback('Invalid required key \'uuid\' in params')
            prlbu.models.Proposal.find(query, (err, docs) => {
              if (err) return callback(err)
              if (prlbu._.isEmpty(docs)) return callback()
              return callback(prlbu.u.unCammel(prlbu.tableName) + ' cannot be deleted, because it has ' + docs.length + ' Proposal(s) associated')
            })
          } catch (error) {
            callback('[beforeDestroy.validateHasProposal] ' + error)
          }
        },
        hasDependencies: (callback) => {
          try {
            prlbu.Validator.hasDependencies(prlbu.tableName, params, (err) => {
              err ? callback(err) : callback()
            })
          } catch (error) {
            callback('[beforeDestroy.hasDependencies] ' + error)
          }
        },
      }
      prlbu.async.series(tasks, (err, _results) => {
        err ? callback(err) : callback()
      })
    } catch (error) {
      callback('afterValidate [ERROR]: ' + error)
    }
  },
  
  /**
   * afterValidate
   * @param {*} params 
   * @param {*} callback 
   * @returns 
   */
  afterValidate: (params, callback) => {
      try {
        if (prlbu._.get(params, 'uuid')) {
          params['uuid'] = String(params['uuid']) 
        }
        const agent = params.agent
        const lead = params.lead
        const data = params.data
        const createdBy = params.createdBy
        const updatedBy = params.updatedBy
        let agentExist
        let leadExist
        let hostCompany
        let proposal
        let content = ''
        let layout = ''
        let agentRole = 'agent'
        let productsSnippets = ''
        let products = []
        let productSkus = []
        if (!prlbu._.isObject(agent)) return callback('Invalid required key \'agent\' in params, should be an object')
        if (!prlbu._.isObject(lead)) return callback('Invalid required key \'lead\' in params, should be an object')
        if (!prlbu._.isObject(data)) return callback('Invalid required key \'data\' in params, should be an object')
        
        const tasks = {
          getHostCompany: (callback) => {
            try {
              if (hostCompany) return callback()
              prlbu.u.getHost((err, _hostCompany) => {
                if (err) return callback(err)
                hostCompany = _hostCompany
                callback()
              })
            } catch (error) {
              callback('[afterValidate.getHostCompany]:  ' + error)
            }
          },
          updateCreateAgent: (callback) => {
            try {
              const email = prlbu._.get(agent, 'email')
              const department = prlbu._.get(agent, 'department')
              let __doc = Object.assign(agent, {createdBy, updatedBy, company: hostCompany.id, type: 'host'})
              if (department) __doc = Object.assign(__doc, { department })
              const obj = {
                modelName: 'user',
                query: {email},
                doc: __doc
              }
              prlbu.u.updateCreateDoc(obj, (err, agent) => {
                if (err) return callback(err)
                params.agent = agent
                callback()
              })
            } catch (error) {
              callback('[afterValidate.updateCreateAgent]:  ' + error)
            }
          },
          validateRol: (callback) => {
            try {
              prlbu.models.Role.findOne(agentRole, (err, rol) => {
                if (err || prlbu._.isEmpty(rol)) return callback('role \'' + agentRole + '\' does not found')
                callback()
              })
            } catch (error) {
              callback('[afterValidate.validateRol]:  ' + error)
            }
          },
          addRoll: (callback) => {
            try {
              prlbu.models.User.findOne(params.agent.id).exec((err, agent) => {
                if (err) return callback(err)
                agent.role.add(agentRole)
                agent.save((err) => {
                  err ? callback(err) : callback()
                })
              })
            } catch (error) {
              callback('[afterValidate.addRoll]:  ' + error)
            }
          },
          updateCreateLead: (callback) => {
            try {
              const email = prlbu._.get(lead, 'email')
              const obj = {
                modelName: 'lead',
                query: {email},
                doc: Object.assign(lead, {createdBy, updatedBy})
              }
              prlbu.u.updateCreateDoc(obj, (err, lead) => {
                if (err) return callback(err)
                params.lead = lead
                callback()
              })
            } catch (error) {
              callback('[afterValidate.updateCreateLead]:  ' + error)
            }
          },
          buildProducts: (callback) => {
            try {
              let items = prlbu._.get(data, 'products')
              if (!items) return callback()
              if (!prlbu._.isArray(items)) return callback(`Invalid 'products' key in 'data' object, should be an array`)
              for (let i = 0; i < items.length; i++) {
                let item = items[i]
                let sku = prlbu._.get(item, 'sku')
                let name = prlbu._.get(item, 'name')
                let price = prlbu._.get(item, 'price') || 0
                let quantity = prlbu._.get(item, 'quantity') || 0
                let taxRate = prlbu._.get(item, 'taxRate') || 0
                let discountRate = prlbu._.get(item, 'discountRate') || 0
                let discountAmount = prlbu._.get(item, 'discountAmount') || 0
                if (!prlbu._.isString(sku)) return callback(`All products should have an 'SKU' key inside product`)
                if (!prlbu._.isString(name)) return callback(`All items should have a 'name' key inside product`)
                if (discountAmount) discountRate = (discountAmount / (price * quantity)) * 100
                if (taxRate) item.taxRate = taxRate
                let beforeDiscount = item.beforeDiscount = (price * quantity)
                let afterDiscount = item.afterDiscount = beforeDiscount - discountAmount
                let taxAmount = item.taxAmount = taxRate ? afterDiscount * (taxRate * 0.01) : 0
                item.subtotal = taxAmount ? (afterDiscount + taxAmount) : afterDiscount
                products.push({
                  quantity,
                  discountRate,
                  taxRate,
                  id: sku,
                  product: item,
                  hidePrice: prlbu._.get(item, 'hidePrice') || false,
                  publicName: prlbu._.get(item, 'publicName'),
                  notExist: true
                })
                // products.push(item)
              }
              callback()
            } catch (error) {
              callback('[afterValidate.buildProducts]:  ' + error)
            }
          },
          chooseProducts: (callback) => {
            callback()
          },
          generateSku: (callback) => {
            callback()
          },
          validateSku: (callback) => {
            callback()
          },
          setSnippet: (callback) => {
            try {
              const metaSnippets = products.reduce((acc, item) => {
                const snippet = prlbu._.get(item, 'product.snippet')
                if (snippet) acc.push(snippet)
                return acc
              }, [])
              if (!prlbu._.isArray(metaSnippets)) return callback()
              prlbu.models.Snippet.find({ slug: { $in: metaSnippets } }, (err, snippets) => {
                if (err) return callback(err)
                productsSnippets = ' '
                for (let i = 0; i < metaSnippets.length; i++) {
                  const snippet = metaSnippets[i]
                  const index = prlbu._.findIndex(snippets, s => s.slug == snippet)
                  let content = prlbu._.get(snippets, `[${index}].content`)
                  if (content) productsSnippets += content
                }
                callback()
              })
            } catch (error) {
              callback('[afterValidate.setSnippet]:  ' + error)
            }
          },
          updateCreateProposal: (callback) => {
            try {
              const title = prlbu._.get(data, 'title')
              const proposalNumber = prlbu._.get(params, 'uuid')
              let append = {
                proposalNumber,
                productsSnippets,
                products,
                createdBy: params.agent.id,
                updatedBy: params.agent.id,
                relatedLead: params.lead.id,
              }
              if (title) append.title = title
              const obj = {
                modelName: 'proposal',
                query: {proposalNumber},
                doc: Object.assign(prlbu._.cloneDeep(data), append),
              }
              prlbu.u.updateCreateDoc(obj, (err, _proposal) => {
                if (err) return callback(err)
                proposal = _proposal
                params.proposal = proposal.id
                params.anonymousUrl = prlbu.u.getDocUrl('proposal', proposal.id)
                params.resolvedUrl = prlbu.u.getDocUrl('proposal', proposal.id, params.lead.email)
                callback()
              })
            } catch (error) {
              callback('[afterValidate.updateCreateProposal]:  ' + error)
            }
          },
          changeStatus: (callback) => {
            try {
              prlbu.models.Proposal.changeStatus({id: proposal.id, status: 'Ready'}, (err, res) => {
                err ? callback(err) : callback()
              })
            } catch (error) {
              callback('[afterValidate.changeStatus]:  ' + error)
            }
          },
          getLeadUrl: (callback) => {
            try {
              let obj = {
                createdBy: params.agent.id,
                updatedBy: params.agent.id,
                url: prlbu.u.getDocUrl('proposal', proposal.id, params.lead.email)
              }
              prlbu.models.UrlShort.generate(obj, (err, res) => {
                if (err) return callback(err)
                params.leadUrl = res.url
                callback()
              })
            } catch (error) {
              callback('[afterValidate.getLeadUrl]:  ' + error)
            }
          },
        }
        prlbu.async.series(tasks, (err) => {
          err ? callback(err) : callback()
        })
      } catch (error) {
        callback('afterValidate [ERROR]: ' + error)
      }
  },
}