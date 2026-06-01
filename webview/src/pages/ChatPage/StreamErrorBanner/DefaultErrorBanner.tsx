interface Props {
    error: Error;
}

export const DefaultErrorBanner = (props: Props) => {
    const { error } = props;

    return (
        <div className="mx-4 my-2 px-3 py-2 rounded-md bg-state-error-bg border border-state-error-border text-state-error-fg text-xs">
            {error.message}
        </div>
    );
};
