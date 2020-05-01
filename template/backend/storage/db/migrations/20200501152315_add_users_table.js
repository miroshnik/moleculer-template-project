exports.up = async (knex) => {
	return knex.schema.createTable('users', (table) => {
		table.string('email').primary()
    table.string('token')
    table.specificType('roles', 'varchar array not null default \'{}\'')
	})
}

exports.down = async (knex) => {
	return knex.schema.dropTable('users')
}
