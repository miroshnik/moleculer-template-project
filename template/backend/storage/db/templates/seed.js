const TABLE = 'table_name'

exports.seed = async (knex) => {
  await knex(TABLE).del()

  return knex(TABLE).insert([
    { id: 1, colName: 'rowValue1' },
    { id: 2, colName: 'rowValue2' },
    { id: 3, colName: 'rowValue3' }
  ])
}
