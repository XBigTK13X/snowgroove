def fk(sa, field, nullable=False):
    return sa.Column(
        field.replace('.', '_'),
        sa.Integer,
        sa.ForeignKey(field, ondelete='CASCADE'),
        nullable=nullable,
    )


def m2m(op, sa, field1, field2):
    name1 = field1.replace('.', '_')
    name2 = field2.replace('.', '_')
    title1 = field1.split('.')[0]
    title2 = field2.split('.')[0]
    title = f'{title1}_{title2}'
    op.create_table(
        title,
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        fk(field1),
        fk(field2),
    )

    op.create_unique_constraint(f'unique_{title}', title, [name1, name2])
