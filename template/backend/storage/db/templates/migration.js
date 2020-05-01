exports.up = async (knex) => {
	// return knex.schema.createTable('table_name', (table) => {
	// 	table.bigIncrements('id').unsigned().primary()
	// 	table.bigint('some_id').unsigned().notNullable().references('id').inTable('some_table')
	//
	// 	table.unique(['field1', 'field2'])
	// })
}

exports.down = async (knex) => {
	// return knex.schema.dropTable('table_name')
}
