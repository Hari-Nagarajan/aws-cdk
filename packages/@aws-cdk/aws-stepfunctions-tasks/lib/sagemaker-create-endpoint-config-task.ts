import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { getResourceArn } from './resource-arn-suffix';
import { ProductionVariants, DataCaptureConfig } from './sagemaker-task-base-types';

/**
 *  @experimental
 */
export interface SagemakerCreateEndpointConfigTaskProps {


    /**
     * The request accepts the following data in JSON format.
     */
    readonly DataCaptureConfig?: DataCaptureConfig;

    /**
     * The name of the endpoint configuration. You specify this name in a CreateEndpoint request.
     */
    readonly EndpointConfigName: string;

    /**
     * Isolates the model container. No inbound or outbound network calls can be made to or from the model container.
     */
    readonly KmsKeyId?: string;

    /**
     * The Amazon Resource Name (ARN) of the IAM role that Amazon SageMaker can assume to access model artifacts and docker image for deployment on ML compute instances or for batch transform jobs. 
     */
    readonly ProductionVariants: ProductionVariants[];

    /**
     * Tags to be applied to the model.
     */
    readonly tags?: {[key: string]: string};

    /**
     * The service integration pattern indicates different ways to call SageMaker APIs.
     *
     * The valid value is FIRE_AND_FORGE.
     *
     * @default FIRE_AND_FORGET
     */
    readonly integrationPattern?: sfn.ServiceIntegrationPattern;

}

/**
 * Class representing the SageMaker Create Training Job task.
 *
 * @experimental
 */
export class SagemakerCreateEndpointConfigTask implements sfn.IStepFunctionsTask {

    private readonly integrationPattern: sfn.ServiceIntegrationPattern;

    constructor(private readonly props: SagemakerCreateEndpointConfigTaskProps) {
        this.integrationPattern = props.integrationPattern || sfn.ServiceIntegrationPattern.FIRE_AND_FORGET;

        const supportedPatterns = [
            sfn.ServiceIntegrationPattern.FIRE_AND_FORGET
        ];

        if (!supportedPatterns.includes(this.integrationPattern)) {
            throw new Error(`Invalid Service Integration Pattern: ${this.integrationPattern} is not supported to call SageMaker:CreateEndpointConfig.`);
        }
    }

    public bind(task: sfn.Task): sfn.StepFunctionsTaskConfig  {

        return {
          resourceArn: getResourceArn("sagemaker", "createEndpointConfig", this.integrationPattern),
          parameters: this.renderParameters(),
          policyStatements: this.makePolicyStatements(task),
        };
    }

    private renderParameters(): {[key: string]: any} {
        return {
            EndpointConfigName: this.props.EndpointConfigName,
            ...(this.renderProductionVariants(this.props.ProductionVariants)),
            ...(this.renderDataCaptureConfig(this.props.DataCaptureConfig)),
            ...(this.renderKmsKeyId(this.props.KmsKeyId)),
            ...(this.renderTags(this.props.tags)),
        };
    }

    private renderDataCaptureConfig(config: DataCaptureConfig | undefined): {[key: string]: any} {
        return (config) ? { DataCaptureConfig: {
            DestinationS3Uri: config.DestinationS3Uri,  
            InitialSamplingPercentage: config.InitialSamplingPercentage,
            ...(config.KmsKeyId) ? {KmsKeyId: config.KmsKeyId} : {},
            ...(config.EnableCapture) ? {EnableCapture: config.EnableCapture} : {},
            ...(config.CaptureOptions) ? { CaptureOptions: config.CaptureOptions.map(
                captureOption => ({
                    CaptureMode: captureOption.CaptureMode
                })
            )} : {},
            ...(config.CaptureContentTypeHeader) ? {
                CaptureContentTypeHeader: {
                    CsvContentTypes: config.CaptureContentTypeHeader.CsvContentTypes,
                    JsonContentTypes: config.CaptureContentTypeHeader.JsonContentTypes
                }
            } : {}
        } } : {}
    }

    private renderKmsKeyId(config: string | undefined): {[key: string]: any} {
        return (config) ? {KmsKeyId: config} : {}
    }

    private renderProductionVariants(configs: ProductionVariants[]): {[key: string]: any} {
        return (configs)? { ProductionVariants: configs.map(config => ({
                ...(config.AcceleratorType) ? { AcceleratorType: config.AcceleratorType }: {},
                ...(config.InitialInstanceCount) ? { InitialInstanceCount: config.InitialInstanceCount }: {},
                ...(config.InitialVariantWeight) ? { InitialVariantWeight: config.InitialVariantWeight }: {},
                ...(config.InstanceType) ? { InstanceType: 'ml.' + config.InstanceType.toString() }: {},
                ...(config.ModelName) ? { ModelName: config.ModelName }: {},
                ...(config.VariantName) ? { VariantName: config.VariantName }: {},
            }))}: {}
    }

    private renderTags(tags: {[key: string]: any} | undefined): {[key: string]: any} {
        return (tags) ? { Tags: Object.keys(tags).map(key => ({ Key: key, Value: tags[key] })) } : {};
    }

    private makePolicyStatements(task: sfn.Task): iam.PolicyStatement[] {
        const stack = Stack.of(task);

        // https://docs.aws.amazon.com/step-functions/latest/dg/sagemaker-iam.html
        const policyStatements = [
            new iam.PolicyStatement({
                actions: ['sagemaker:CreateEndpointConfig'],
                resources: ['*'],
            }),
            new iam.PolicyStatement({
                actions: ['sagemaker:ListTags'],
                resources: ['*']
            }),
        ];

        return policyStatements;
      }
}
